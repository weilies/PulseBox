/** Client-safe timezone constants and formatters. No server imports. */

export const COMMON_TIMEZONES = [
  { label: "Singapore (UTC+8)", value: "Asia/Singapore" },
  { label: "Kuala Lumpur (UTC+8)", value: "Asia/Kuala_Lumpur" },
  { label: "Jakarta (UTC+7)", value: "Asia/Jakarta" },
  { label: "Bangkok (UTC+7)", value: "Asia/Bangkok" },
  { label: "Hong Kong (UTC+8)", value: "Asia/Hong_Kong" },
  { label: "Shanghai (UTC+8)", value: "Asia/Shanghai" },
  { label: "Tokyo (UTC+9)", value: "Asia/Tokyo" },
  { label: "Seoul (UTC+9)", value: "Asia/Seoul" },
  { label: "Mumbai (UTC+5:30)", value: "Asia/Kolkata" },
  { label: "Dubai (UTC+4)", value: "Asia/Dubai" },
  { label: "London (UTC+0/+1)", value: "Europe/London" },
  { label: "Paris (UTC+1/+2)", value: "Europe/Paris" },
  { label: "New York (UTC-5/-4)", value: "America/New_York" },
  { label: "Los Angeles (UTC-8/-7)", value: "America/Los_Angeles" },
  { label: "UTC", value: "UTC" },
] as const;

export function formatDatetime(value: string, timezone: string): string {
  try {
    return new Date(value).toLocaleString("en-SG", {
      timeZone: timezone,
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return value;
  }
}

/**
 * Convert a datetime-local input value ("YYYY-MM-DDTHH:mm") interpreted in
 * `timezone` to a UTC ISO string. Safe to call on the client.
 */
export function datetimeLocalToISO(localStr: string, timezone: string): string {
  try {
    // Parse the local string as if it were UTC to get a reference point
    const baseUTC = new Date(localStr + ":00.000Z");

    // Find out what that UTC moment looks like in the target timezone
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    }).formatToParts(baseUTC);

    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
    const hour = parseInt(get("hour")) % 24; // normalise "24" → 0

    const tzDisplayedAsUTC = new Date(Date.UTC(
      parseInt(get("year")),
      parseInt(get("month")) - 1,
      parseInt(get("day")),
      hour,
      parseInt(get("minute")),
      parseInt(get("second")),
    ));

    // offsetMs = UTC_we_picked − what_the_TZ_shows_for_it (i.e. the TZ's UTC offset negated)
    const offsetMs = baseUTC.getTime() - tzDisplayedAsUTC.getTime();
    return new Date(baseUTC.getTime() + offsetMs).toISOString();
  } catch {
    return localStr;
  }
}

/**
 * Convert a UTC ISO string to "YYYY-MM-DDTHH:mm" for use in a datetime-local
 * input, displaying local time in `timezone`.
 */
export function isoToDatetimeLocal(isoStr: string, timezone: string): string {
  try {
    const date = new Date(isoStr);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
      hour12: false,
    }).formatToParts(date);

    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
    const hour = String(parseInt(get("hour")) % 24).padStart(2, "0");
    return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
  } catch {
    return isoStr;
  }
}

export function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString("en-SG", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return value;
  }
}
