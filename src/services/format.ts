import type { Currency, TimeEntry } from "../database/schema";
export function currencyDigits(currency: Currency) {
  return (
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2
  );
}
export function parseMoney(value: string, currency: Currency): number | null {
  if (!value.trim()) return null;
  const digits = currencyDigits(currency);
  if (
    !new RegExp(`^\\d{1,10}(?:\\.\\d{1,${Math.max(1, digits)}})?$`).test(
      value.trim(),
    ) ||
    (digits === 0 && value.includes("."))
  )
    throw new Error(
      `Enter a non-negative amount with up to ${digits} decimal places.`,
    );
  const [whole, fraction = ""] = value.trim().split(".");
  const minor =
    Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, "0"));
  if (!Number.isSafeInteger(minor) || minor > 100_000_000_000)
    throw new Error("Amount is too large.");
  return minor;
}
export function moneyInput(value: number | null, currency: Currency) {
  return value === null
    ? ""
    : (value / 10 ** currencyDigits(currency)).toFixed(
        currencyDigits(currency),
      );
}
export function money(value: number, currency: Currency) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(value / 10 ** currencyDigits(currency));
}
export function duration(ms: number) {
  const s = Math.floor(Math.max(0, ms) / 1000);
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}
export function date(value: number, iso = false) {
  return iso
    ? new Date(value).toLocaleDateString("sv-SE")
    : new Date(value).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}
export function dateTime(value: number | null | undefined) {
  return value ? new Date(value).toLocaleString() : "Not yet";
}
export function entryValue(entry: TimeEntry) {
  return entry.billable && entry.rateMinor !== null
    ? Math.round((entry.durationMs * entry.rateMinor) / 3600000)
    : 0;
}
// Pauses have no individual intervals in v1. Split total tracked time proportionally over the session's wall-time span.
export function timeInRange(entry: TimeEntry, from: number, to: number) {
  const span = entry.endedAt - entry.startedAt;
  const overlap = Math.max(
    0,
    Math.min(to, entry.endedAt) - Math.max(from, entry.startedAt),
  );
  return span ? Math.round((entry.durationMs * overlap) / span) : 0;
}
export function localInput(timestamp: number) {
  const d = new Date(timestamp);
  return new Date(timestamp - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 23);
}
