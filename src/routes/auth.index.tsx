// Leaf route for /auth. The parent /auth route is a layout so /auth/verify
// and /auth/reset can render their own screens inside its <Outlet />.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/")({});