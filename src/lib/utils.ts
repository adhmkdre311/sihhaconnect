import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ------------------------------------------------------------------ *
 * Date / time helpers (locale-independent, safe for SSR and tests).
 * Locale-aware formatting for screens lives in src/lib/format.ts.
 * ------------------------------------------------------------------ */

/** ISO calendar day, e.g. "2026-08-10". */
export function toIsoDate(value: string | number | Date): string {
  return new Date(value).toISOString().slice(0, 10);
}

/** 24h clock in the given time zone, e.g. "14:05". */
export function toClockTime(value: string | number | Date, timeZone = "Asia/Qatar"): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(new Date(value));
}

/** Whole-month difference, used by the compliance cadence engine. */
export function monthsBetween(from: string | number | Date, to: string | number | Date): number {
  const a = new Date(from);
  const b = new Date(to);
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) months -= 1;
  return months;
}

/** Great-circle distance in kilometres (haversine, mean Earth radius). */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371.0088;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/* ------------------------------------------------------------------ *
 * CSV export (RFC 4180 quoting) — shared by every portal export.
 * ------------------------------------------------------------------ */

export type CsvCell = string | number | boolean | null | undefined | Date;

function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '""';
  const raw = value instanceof Date ? value.toISOString() : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

/** Every cell is quoted, embedded quotes doubled, rows joined with CRLF. */
export function toCsv(rows: CsvCell[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

/** Browser-only: trigger a CSV download from in-memory rows. */
export function downloadCsv(filename: string, rows: CsvCell[][]) {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
