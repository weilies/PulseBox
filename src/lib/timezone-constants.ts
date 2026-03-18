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
