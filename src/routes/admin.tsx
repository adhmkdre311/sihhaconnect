import { createFileRoute, Outlet } from "@tanstack/react-router";
import { StaffFrame } from "@/components/StaffFrame";
import { LayoutDashboard, Users, Building2, Megaphone, Database, BarChart3, ScrollText, Settings, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: () => (
    <StaffFrame
      role="platform_admin"
      roleLabel="Platform admin"
      requireApproved={false}
      items={[
        { to: "/admin", icon: LayoutDashboard, label: "Dashboard" },
        { to: "/admin/users", icon: Users, label: "Users & roles" },
        { to: "/admin/orgs", icon: Building2, label: "Organizations" },
        { to: "/admin/announcements", icon: Megaphone, label: "Content" },
        { to: "/admin/records", icon: Database, label: "Data records" },
        { to: "/admin/analytics", icon: BarChart3, label: "Analytics" },
        { to: "/admin/audit", icon: ScrollText, label: "Audit logs" },
        { to: "/admin/settings", icon: Settings, label: "Settings" },
        { to: "/admin/approvals", icon: ShieldCheck, label: "Approvals" },
      ]}
    >
      <Outlet />
    </StaffFrame>
  ),
});