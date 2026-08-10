import { describe, expect, it } from "vitest";
import { distanceKm, monthsBetween, toClockTime, toCsv, toIsoDate } from "../../src/lib/utils";

describe("date / time formatting", () => {
  it("formats ISO calendar days", () => {
    expect(toIsoDate("2026-08-10T21:30:00Z")).toBe("2026-08-10");
    expect(toIsoDate(new Date(Date.UTC(2026, 0, 1, 5)))).toBe("2026-01-01");
  });

  it("formats a 24h clock in Qatar time", () => {
    expect(toClockTime("2026-08-10T06:05:00Z")).toBe("09:05");
    expect(toClockTime("2026-08-10T21:00:00Z")).toBe("00:00");
    expect(toClockTime("2026-08-10T06:05:00Z", "UTC")).toBe("06:05");
  });

  it("counts whole months for the compliance cadence", () => {
    expect(monthsBetween("2026-01-15", "2026-07-15")).toBe(6);
    expect(monthsBetween("2026-01-15", "2026-07-14")).toBe(5);
    expect(monthsBetween("2025-12-31", "2026-01-31")).toBe(1);
    expect(monthsBetween("2026-07-15", "2026-01-15")).toBe(-6);
  });
});

describe("distanceKm", () => {
  // Reference pairs with published great-circle distances.
  const cases: Array<[string, { lat: number; lng: number }, { lat: number; lng: number }, number]> = [
    ["Doha → Al Wakrah", { lat: 25.2854, lng: 51.531 }, { lat: 25.1715, lng: 51.6034 }, 15.45],
    ["Doha → Dubai", { lat: 25.2854, lng: 51.531 }, { lat: 25.2048, lng: 55.2708 }, 375.6],
    ["equator 1° of longitude", { lat: 0, lng: 0 }, { lat: 0, lng: 1 }, 111.195],
    ["1° of latitude", { lat: 0, lng: 0 }, { lat: 1, lng: 0 }, 111.195],
  ];

  it.each(cases)("%s is accurate within 1%%", (_label, a, b, expected) => {
    const got = distanceKm(a, b);
    expect(Math.abs(got - expected) / expected).toBeLessThan(0.01);
  });

  it("is zero for the same point and symmetric", () => {
    const a = { lat: 25.2854, lng: 51.531 };
    const b = { lat: 25.1715, lng: 51.6034 };
    expect(distanceKm(a, a)).toBe(0);
    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 9);
  });
});

describe("toCsv escaping", () => {
  it("quotes every cell and joins rows with CRLF", () => {
    expect(toCsv([["a", "b"], ["1", "2"]])).toBe('"a","b"\r\n"1","2"');
  });

  it("doubles embedded quotes", () => {
    expect(toCsv([['he said "hi"']])).toBe('"he said ""hi"""');
  });

  it("keeps commas, newlines and leading = inside the quoted cell", () => {
    expect(toCsv([["Doha, Qatar"]])).toBe('"Doha, Qatar"');
    expect(toCsv([["line1\nline2"]])).toBe('"line1\nline2"');
    expect(toCsv([["=1+1"]])).toBe('"=1+1"');
  });

  it("renders null / undefined as empty cells and dates as ISO", () => {
    expect(toCsv([[null, undefined, 0, false]])).toBe('"","","0","false"');
    expect(toCsv([[new Date(Date.UTC(2026, 7, 10))]])).toBe('"2026-08-10T00:00:00.000Z"');
  });
});