"use client";

import { createClient } from "@/lib/supabase/client";

type LogLevel = "info" | "warn" | "error" | "fatal";
type LogCategory =
  | "page_view"
  | "click_error"
  | "unhandled_error"
  | "component_error"
  | "api_error";

interface LogEntry {
  tenant_id: string | null;
  user_id: string | null;
  level: LogLevel;
  category: LogCategory;
  message: string;
  metadata: Record<string, unknown>;
}

const BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 5000;

class Logger {
  private queue: LogEntry[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private tenantId: string | null = null;
  private userId: string | null = null;
  private initialized = false;

  private async init() {
    if (this.initialized) return;
    this.initialized = true;

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      this.userId = user?.id ?? null;
    } catch {
      // If auth fails, log without user context
    }

    // Read tenant from cookie
    const match = document.cookie.match(/(?:^|;\s*)pb-tenant=([^;]*)/);
    this.tenantId = match ? decodeURIComponent(match[1]) : null;

    // Flush on interval
    this.timer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);

    // Flush before page unload
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => this.flush());
    }
  }

  async log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    metadata: Record<string, unknown> = {}
  ) {
    await this.init();

    this.queue.push({
      tenant_id: this.tenantId,
      user_id: this.userId,
      level,
      category,
      message,
      metadata: {
        ...metadata,
        url: typeof window !== "undefined" ? window.location.href : undefined,
        timestamp: new Date().toISOString(),
      },
    });

    if (this.queue.length >= BATCH_SIZE) {
      this.flush();
    }
  }

  pageView(path: string) {
    this.log("info", "page_view", `Viewed ${path}`, { path });
  }

  error(
    category: LogCategory,
    message: string,
    metadata: Record<string, unknown> = {}
  ) {
    this.log("error", category, message, metadata);
  }

  private async flush() {
    if (this.queue.length === 0) return;

    // Don't flush if not authenticated — RLS policy requires authenticated role
    if (!this.userId) return;

    const batch = this.queue.splice(0);

    try {
      const supabase = createClient();
      const { error } = await supabase.from("app_logs").insert(batch);
      if (error) {
        // Put failed entries back (but cap to prevent memory leak)
        if (this.queue.length < 100) {
          this.queue.unshift(...batch);
        }
        console.error("[PulseBox Logger] Flush failed:", error.message);
      }
    } catch (err) {
      console.error("[PulseBox Logger] Flush error:", err);
    }
  }

  destroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.flush();
  }
}

// Singleton
export const logger = typeof window !== "undefined" ? new Logger() : null;
