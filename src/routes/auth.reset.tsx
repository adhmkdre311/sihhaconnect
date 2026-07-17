// BUG-12: eager route shell — component ships from auth.reset.lazy.tsx.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/reset")({});