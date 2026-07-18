// Layout route for /auth children. The actual login/signup form lives in
// auth.index.lazy.tsx so /auth/verify and /auth/reset are not hidden by it.
import { createLazyFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/auth")({
  component: AuthLayout,
});

function AuthLayout() {
  return <Outlet />;
}
