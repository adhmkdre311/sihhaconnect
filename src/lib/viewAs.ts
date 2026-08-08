// M7: read-only "view as role" session state for platform admins.
import { useCallback, useEffect, useState } from "react";

export const VIEW_AS_ROLES = ["clinic_staff", "employer_admin", "pharmacy_staff", "insurance_staff", "worker"] as const;
export type ViewAsRole = (typeof VIEW_AS_ROLES)[number];

const KEY = "sihha:view-as";
const EVENT = "sihha:view-as-changed";

export function readViewAs(): ViewAsRole | null {
  if (typeof window === "undefined") return null;
  const v = window.sessionStorage.getItem(KEY);
  return (VIEW_AS_ROLES as readonly string[]).includes(v ?? "") ? (v as ViewAsRole) : null;
}

export function setViewAs(role: ViewAsRole | null) {
  if (typeof window === "undefined") return;
  if (role) window.sessionStorage.setItem(KEY, role);
  else window.sessionStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}

/** Null during SSR/first paint to avoid hydration mismatches. */
export function useViewAs() {
  const [role, setRole] = useState<ViewAsRole | null>(null);
  const sync = useCallback(() => setRole(readViewAs()), []);
  useEffect(() => {
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, [sync]);
  return role;
}
