/**
 * POST /api/automata/dispatch
 *
 * Called by pg_cron every minute (via pg_net HTTP POST).
 * Protected by X-Dispatcher-Secret header matching DISPATCHER_SECRET env var.
 *
 * Picks up all installed apps where:
 *   enabled = true AND next_run_at <= now()
 *
 * For each due app:
 *   1. Creates an integration_job_runs record (status=running, triggered_by=scheduler)
 *   2. Triggers the n8n workflow
 *   3. Recalculates and writes next_run_at
 *
 * This is NOT exposed to tenants — it is a platform-internal endpoint.
 */

import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import * as N8n from "@/lib/services/n8n.service";
import { calculateNextRun } from "@/lib/cron-utils";

const DISPATCHER_SECRET = process.env.DISPATCHER_SECRET ?? "";

export async function POST(request: NextRequest) {
  // Validate secret
  const secret = request.headers.get("X-Dispatcher-Secret");
  if (!DISPATCHER_SECRET || secret !== DISPATCHER_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const now = new Date().toISOString();

  // Fetch all due apps
  const { data: dueApps, error: fetchError } = await db
    .from("tenant_installed_apps")
    .select(`
      id, config, schedule_timezone, n8n_workflow_id,
      platform_apps(config_schema)
    `)
    .eq("enabled", true)
    .lte("next_run_at", now)
    .not("next_run_at", "is", null);

  if (fetchError) {
    return Response.json({ error: fetchError.message }, { status: 500 });
  }

  if (!dueApps || dueApps.length === 0) {
    return Response.json({ dispatched: 0 });
  }

  const results: { id: string; status: string; error?: string }[] = [];

  for (const app of dueApps) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const appAny = app as any;
      const config = (app.config ?? {}) as Record<string, unknown>;

      // Find the cron field value from config
      const fields: Array<{ key: string; type: string }> =
        appAny.platform_apps?.config_schema?.fields ?? [];
      const cronField = fields.find((f) => f.type === "cron");
      const cronExpr = cronField ? (config[cronField.key] as string) ?? "" : "";

      if (!app.n8n_workflow_id) {
        results.push({ id: app.id, status: "skipped", error: "No n8n workflow linked" });
        continue;
      }

      // Create job run record
      const { data: runRecord, error: runError } = await db
        .from("integration_job_runs")
        .insert({
          tenant_installed_app_id: app.id,
          status: "running",
          triggered_at: new Date().toISOString(),
          triggered_by: "scheduler",
        })
        .select("id")
        .single();

      if (runError || !runRecord) {
        results.push({ id: app.id, status: "error", error: runError?.message ?? "Failed to create run record" });
        continue;
      }

      // Trigger n8n workflow
      const triggerResult = await N8n.triggerWorkflow(app.n8n_workflow_id);

      if ("error" in triggerResult) {
        // Mark run as failed
        await db
          .from("integration_job_runs")
          .update({ status: "failed", completed_at: new Date().toISOString() })
          .eq("id", runRecord.id);
        results.push({ id: app.id, status: "error", error: triggerResult.error });
      } else {
        // Update run with execution ID
        if ("executionId" in triggerResult && triggerResult.executionId) {
          await db
            .from("integration_job_runs")
            .update({ n8n_execution_id: String(triggerResult.executionId) })
            .eq("id", runRecord.id);
        }
        results.push({ id: app.id, status: "dispatched" });
      }

      // Recalculate next_run_at
      const timezone = app.schedule_timezone ?? "UTC";
      const nextRun = cronExpr ? calculateNextRun(cronExpr, timezone) : null;
      await db
        .from("tenant_installed_apps")
        .update({ next_run_at: nextRun ? nextRun.toISOString() : null })
        .eq("id", app.id);

    } catch (err) {
      results.push({ id: app.id, status: "error", error: String(err) });
    }
  }

  const dispatched = results.filter((r) => r.status === "dispatched").length;
  const errored = results.filter((r) => r.status === "error").length;

  return Response.json({ dispatched, errored, results });
}
