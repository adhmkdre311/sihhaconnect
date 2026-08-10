import { describe, expect, it } from "vitest";
import { APP_ROLES, LOGIN_PATH, ROLE_HOME, homeForRoles, resolveLanding, safeNext } from "../../src/lib/portals";

describe("each role lands on its own portal", () => {
  const expected: Record<string, string> = {
    worker: "/app",
    employer_admin: "/employer",
    clinic_staff: "/clinic",
    pharmacy_staff: "/pharmacy",
    insurance_staff: "/insurance",
    platform_admin: "/admin",
    super_admin: "/admin",
  };

  it.each(APP_ROLES)("%s → its portal", (role) => {
    expect(ROLE_HOME[role]).toBe(expected[role]);
    expect(homeForRoles([role])).toBe(expected[role]);
  });

  it("multi-role accounts land on the most privileged portal", () => {
    expect(homeForRoles(["worker", "platform_admin"])).toBe("/admin");
    expect(homeForRoles(["worker", "clinic_staff"])).toBe("/clinic");
    expect(homeForRoles(["worker", "insurance_staff"])).toBe("/insurance");
  });

  it("unknown roles do not resolve to a portal", () => {
    expect(homeForRoles(["visitor"])).toBeNull();
    expect(homeForRoles([])).toBeNull();
  });
});

describe("unauthenticated visitors go to the login screen", () => {
  it("redirects regardless of claimed roles", () => {
    expect(resolveLanding({ signedIn: false })).toBe(LOGIN_PATH);
    expect(resolveLanding({ signedIn: false, roles: ["platform_admin"] })).toBe(LOGIN_PATH);
    expect(resolveLanding({ signedIn: false, next: "/admin" })).toBe(LOGIN_PATH);
  });

  it("signed-in users honour a safe next, else their portal", () => {
    expect(resolveLanding({ signedIn: true, roles: ["worker"], next: "/app/records" })).toBe("/app/records");
    expect(resolveLanding({ signedIn: true, roles: ["worker"] })).toBe("/app");
    expect(resolveLanding({ signedIn: true, roles: [] })).toBeNull();
  });
});

describe("safeNext rejects off-origin and malformed targets", () => {
  it.each(["https://evil.test", "//evil.test", "/\\evil", "javascript:alert(1)", "", 5, null, undefined])(
    "rejects %s",
    (value) => {
      expect(safeNext(value)).toBeUndefined();
    },
  );

  it("accepts same-origin paths", () => {
    expect(safeNext("/employer/roster")).toBe("/employer/roster");
  });
});