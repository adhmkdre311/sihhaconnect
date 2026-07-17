// BUG-12: minimal eager route — validateSearch only. The heavy AuthPage
// component ships from auth.lazy.tsx and is fetched only when /auth is visited.
import { createFileRoute } from "@tanstack/react-router";

const ROLES = ["worker", "employer_admin", "clinic_staff"] as const;
export type Role = (typeof ROLES)[number];
export type AuthMode = "login" | "signup";

export function parseRole(value: unknown): Role {
  return (ROLES as readonly string[]).includes(value as string) ? (value as Role) : "worker";
}

export function parseMode(value: unknown): AuthMode {
  return value === "signup" ? "signup" : "login";
}

export function parseNext(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return undefined;
  return value;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    role: parseRole(s.role),
    mode: parseMode(s.mode),
    next: parseNext(s.next),
  }),
});