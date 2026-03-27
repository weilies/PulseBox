"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, CircleCheck, CircleX, Clock, AlertTriangle } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import type { ActivityEntry } from "@/app/actions/webhooks";

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "delivered":
    case "success":
      return <CircleCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />;
    case "failed":
      return <CircleX className="h-3.5 w-3.5 text-red-400 shrink-0" />;
    case "blocked":
      return <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
    default:
      return <Clock className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 shrink-0" />;
  }
}

function statusColor(status: string) {
  switch (status) {
    case "delivered":
    case "success":
      return "text-emerald-600 dark:text-emerald-400";
    case "failed":
      return "text-red-400";
    case "blocked":
      return "text-amber-500 dark:text-amber-400";
    default:
      return "text-gray-500 dark:text-gray-400";
  }
}

function categoryBadge(category: string) {
  const colors: Record<string, string> = {
    audit:   "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400",
    webhook: "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400",
    api:     "bg-violet-50 dark:bg-violet-950 border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400",
    auth:    "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400",
    data:    "bg-cyan-50 dark:bg-cyan-950 border-cyan-200 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400",
    email:   "bg-pink-50 dark:bg-pink-950 border-pink-200 dark:border-pink-800 text-pink-600 dark:text-pink-400",
  };
  const cls = colors[category] ?? "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400";
  return `inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`;
}

function JsonBlock({ label, data }: { label: string; data: Record<string, unknown> }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <pre className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-3 text-xs text-gray-700 dark:text-gray-300 font-mono overflow-x-auto whitespace-pre-wrap break-all">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function AuditDiff({ old_data, new_data, action }: {
  old_data: Record<string, unknown> | null | undefined;
  new_data: Record<string, unknown> | null | undefined;
  action: string;
}) {
  if (action === "item.insert") {
    return new_data ? <JsonBlock label="Inserted data" data={new_data} /> : null;
  }
  if (action === "item.delete") {
    return old_data ? <JsonBlock label="Deleted data" data={old_data} /> : null;
  }
  // update — show side-by-side diff
  if (action === "item.update" && (old_data || new_data)) {
    // Show changed fields only
    const allKeys = new Set([
      ...Object.keys(old_data ?? {}),
      ...Object.keys(new_data ?? {}),
    ]);
    const changed: Record<string, { before: unknown; after: unknown }> = {};
    for (const key of allKeys) {
      const before = (old_data ?? {})[key];
      const after = (new_data ?? {})[key];
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        changed[key] = { before, after };
      }
    }
    if (Object.keys(changed).length === 0) {
      return (
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Changes</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 italic">No field changes detected.</p>
        </div>
      );
    }
    return (
      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Changed fields</p>
        <div className="space-y-2">
          {Object.entries(changed).map(([key, { before, after }]) => (
            <div key={key} className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden text-xs font-mono">
              <div className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-semibold border-b border-gray-200 dark:border-gray-700">
                {key}
              </div>
              <div className="grid grid-cols-2 divide-x divide-gray-200 dark:divide-gray-700">
                <div className="px-2 py-1.5 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 break-all">
                  <span className="text-red-400 dark:text-red-600 mr-1">−</span>
                  {before === null || before === undefined ? <span className="italic text-gray-400">null</span> : JSON.stringify(before)}
                </div>
                <div className="px-2 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 break-all">
                  <span className="text-emerald-400 dark:text-emerald-600 mr-1">+</span>
                  {after === null || after === undefined ? <span className="italic text-gray-400">null</span> : JSON.stringify(after)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

export function LogRow({ log, isEven, timezone }: { log: ActivityEntry; isEven: boolean; timezone?: string }) {
  const [expanded, setExpanded] = useState(false);

  const isAudit = log.category === "audit";
  const hasPayload = isAudit
    ? !!(log.old_data || log.new_data)
    : !!(log.request_body || log.response_body);

  return (
    <>
      <TableRow
        className={`border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
          isEven ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800/30"
        } ${hasPayload ? "cursor-pointer" : ""}`}
        onClick={() => hasPayload && setExpanded((p) => !p)}
      >
        {/* Expand toggle */}
        <TableCell className="w-8 pr-0">
          {hasPayload ? (
            expanded
              ? <ChevronDown className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
              : <ChevronRight className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
          ) : (
            <span className="w-3.5 block" />
          )}
        </TableCell>

        <TableCell className="text-xs text-gray-500 dark:text-gray-400 font-mono whitespace-nowrap">
          {new Date(log.created_at).toLocaleString(undefined, timezone ? { timeZone: timezone } : undefined)}
        </TableCell>

        <TableCell>
          <span className={categoryBadge(log.category)}>{log.category}</span>
        </TableCell>

        <TableCell>
          <code className="text-xs text-blue-600 dark:text-blue-400 font-mono">{log.event_type}</code>
          {log.request_url && (
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[260px] mt-0.5" title={log.request_url}>
              {log.request_url}
            </p>
          )}
          {isAudit && log.item_id && (
            <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-0.5 truncate max-w-[260px]" title={log.item_id}>
              item: {log.item_id}
            </p>
          )}
        </TableCell>

        <TableCell>
          <div className="flex items-center gap-1.5">
            <StatusIcon status={log.status} />
            <span className={`text-xs font-medium ${statusColor(log.status)}`}>{log.status}</span>
          </div>
        </TableCell>

        <TableCell className="text-right">
          {log.response_status ? (
            <span className={`text-xs font-mono ${log.response_status < 300 ? "text-emerald-600 dark:text-emerald-400" : "text-red-400"}`}>
              {log.response_status}
            </span>
          ) : <span className="text-xs text-gray-300 dark:text-gray-600">—</span>}
        </TableCell>

        <TableCell className="text-right">
          {log.duration_ms != null
            ? <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{log.duration_ms}ms</span>
            : <span className="text-xs text-gray-300 dark:text-gray-600">—</span>}
        </TableCell>

        <TableCell>
          {log.scope_id
            ? <code className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-xs text-blue-600 dark:text-blue-400 font-mono">{log.scope_id}</code>
            : <span className="text-xs text-gray-300 dark:text-gray-600">—</span>}
        </TableCell>
      </TableRow>

      {/* Expanded payload row */}
      {expanded && hasPayload && (
        <TableRow className={`border-gray-200 dark:border-gray-700 ${isEven ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800/30"}`}>
          <TableCell colSpan={8} className="pt-0 pb-3 px-10">
            <div className="space-y-3">
              {isAudit ? (
                <AuditDiff
                  old_data={log.old_data}
                  new_data={log.new_data}
                  action={log.event_type}
                />
              ) : (
                <>
                  {log.request_body && <JsonBlock label="Request payload" data={log.request_body} />}
                  {log.response_body && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Response body</p>
                      <pre className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-3 text-xs text-gray-700 dark:text-gray-300 font-mono overflow-x-auto whitespace-pre-wrap break-all">
                        {log.response_body}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
