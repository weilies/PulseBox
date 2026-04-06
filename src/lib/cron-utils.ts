/**
 * Server-safe cron utilities — no external dependencies.
 * Supports standard 5-field cron: minute hour day-of-month month day-of-week
 * Field syntax: * (any) | number | star/n (step) | a,b,c (list) | a-b (range)
 */

// ---------------------------------------------------------------------------
// Field matcher
// ---------------------------------------------------------------------------

function matchField(value: number, expr: string): boolean {
  if (expr === "*") return true;

  if (expr.startsWith("*/")) {
    const step = parseInt(expr.slice(2), 10);
    return !isNaN(step) && step > 0 && value % step === 0;
  }

  if (expr.includes(",")) {
    return expr.split(",").some((part) => matchField(value, part.trim()));
  }

  if (expr.includes("-")) {
    const [lo, hi] = expr.split("-").map((n) => parseInt(n, 10));
    return !isNaN(lo) && !isNaN(hi) && value >= lo && value <= hi;
  }

  return parseInt(expr, 10) === value;
}

// ---------------------------------------------------------------------------
// Timezone-aware date-part extractor via Intl
// ---------------------------------------------------------------------------

interface DateParts {
  minute: number;
  hour: number;
  day: number;
  month: number;   // 1-12
  weekday: number; // 0=Sun … 6=Sat
}

function getPartsInTz(date: Date, timezone: string): DateParts {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
      hour12: false,
    });

    const parts: Record<string, string> = {};
    for (const p of dtf.formatToParts(date)) {
      parts[p.type] = p.value;
    }

    // Intl returns "24" for midnight in some locales; normalise to 0
    const hour = parseInt(parts.hour ?? "0", 10) % 24;

    const WEEKDAY_IDX: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    const weekday = WEEKDAY_IDX[parts.weekday ?? "Sun"] ?? 0;

    return {
      minute: parseInt(parts.minute ?? "0", 10),
      hour,
      day: parseInt(parts.day ?? "1", 10),
      month: parseInt(parts.month ?? "1", 10),
      weekday,
    };
  } catch {
    // Fallback to UTC if timezone is invalid
    return {
      minute: date.getUTCMinutes(),
      hour: date.getUTCHours(),
      day: date.getUTCDate(),
      month: date.getUTCMonth() + 1,
      weekday: date.getUTCDay(),
    };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the next Date on which the cron expression fires, starting strictly
 * after `now` (or the current time if omitted).  Looks up to 366 days ahead.
 * Returns null if the expression is invalid or no match found within that window.
 */
export function calculateNextRun(
  cronExpr: string,
  timezone = "UTC",
  from?: Date
): Date | null {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [minExpr, hourExpr, domExpr, monthExpr, dowExpr] = parts;

  // Start from the next minute after `from`
  const base = from ? new Date(from) : new Date();
  base.setSeconds(0, 0);
  base.setTime(base.getTime() + 60_000); // +1 min so we never return "now"

  const MINUTE_MS = 60_000;
  const MAX_ITERATIONS = 366 * 24 * 60; // ~1 year

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const candidate = new Date(base.getTime() + i * MINUTE_MS);
    const p = getPartsInTz(candidate, timezone);

    if (
      matchField(p.minute, minExpr) &&
      matchField(p.hour, hourExpr) &&
      matchField(p.day, domExpr) &&
      matchField(p.month, monthExpr) &&
      matchField(p.weekday, dowExpr)
    ) {
      return candidate;
    }
  }

  return null;
}

/**
 * Formats a Date in a given timezone as a readable string.
 * e.g. "Mon, Apr 7 at 06:00 AM (SGT)"
 */
export function formatInTz(date: Date, timezone = "UTC"): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(date);
  } catch {
    return date.toUTCString();
  }
}
