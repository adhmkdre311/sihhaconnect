// Eager route shell for the custom Resend verification handler.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/verify")({
  validateSearch: (s: Record<string, unknown>) => ({
    token_hash: typeof s.token_hash === "string" ? s.token_hash : undefined,
    type: typeof s.type === "string" ? s.type : undefined,
    code: typeof s.code === "string" ? s.code : undefined,
  }),
});
