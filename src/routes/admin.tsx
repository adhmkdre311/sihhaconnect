import { createFileRoute, Outlet } from "@tanstack/react-router";
import { StaffFrame } from "@/components/StaffFrame";
import { ShieldCheck, Building2, Pill, Landmark } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: () => (
    <StaffFrame
      role="platform_admin"
      roleLabel="Platform admin"
      requireApproved={false}
      items={[
        { to: "/admin", icon: ShieldCheck, label: "Approvals" },
        { to: "/admin/orgs", icon: Building2, label: "Organisations" },
        { to: "/admin/pharmacies", icon: Pill, label: "Pharmacies & meds" },
        { to: "/admin/insurers", icon: Landmark, label: "Insurers" },
      ]}
    >
      <Outlet />
    </StaffFrame>
  ),
});