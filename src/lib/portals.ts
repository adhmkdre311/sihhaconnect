// Single source of truth for "which portal does this account belong in".
// Used by the landing redirect, the auth screen and the guard tests (§9.1).

export const APP_ROLES = [
  "platform_admin",
  "super_admin",
  "employer_admin",
  "clinic_staff",
  "pharmacy_staff",
  "insurance_staff",
  "worker",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_HOME: Record<AppRole, string> = {
  platform_admin: "/admin",
  super_admin: "/admin",
  employer_admin: "/employer",
  clinic_staff: "/clinic",
  pharmacy_staff: "/pharmacy",
  insurance_staff: "/insurance",
  worker: "/app",
};

/** Most privileged role first, so multi-role accounts land predictably. */
export const ROLE_PRIORITY: readonly AppRole[] = APP_ROLES;

export const LOGIN_PATH = "/auth";

export function homeForRoles(roles: readonly string[]): string | null {
  const picked = ROLE_PRIORITY.find((r) => roles.includes(r));
  return picked ? ROLE_HOME[picked] : null;
}

/** Sanitized same-origin redirect target, or undefined when unsafe. */
export function safeNext(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return undefined;
  return value;
}

/**
 * Where a visitor should be sent. `null` means "stay on the current page".
 * Unauthenticated visitors always go to the login screen.
 */
export function resolveLanding(input: {
  signedIn: boolean;
  roles?: readonly string[];
  next?: unknown;
}): string | null {
  if (!input.signedIn) return LOGIN_PATH;
  const next = safeNext(input.next);
  if (next) return next;
  return homeForRoles(input.roles ?? []);
}