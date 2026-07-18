// BUG-12: eager route shell — component ships from auth.reset.lazy.tsx.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/reset")({
  validateSearch: (s: Record<string, unknown>) => ({
    token_hash: typeof s.token_hash === "string" ? s.token_hash : undefined,
    type: typeof s.type === "string" ? s.type : undefined,
  }),
});