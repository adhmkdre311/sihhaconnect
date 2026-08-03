import { createFileRoute, Outlet } from "@tanstack/react-router";
import { StaffFrame } from "@/components/StaffFrame";
import { Package, BarChart3, Settings } from "lucide-react";

export const Route = createFileRoute("/pharmacy")({
  component: () => (
    <StaffFrame role="pharmacy_staff" roleLabel="Pharmacy hub"
      items={[
        { to: "/pharmacy", icon: Package, label: "Availability" },
        { to: "/pharmacy/visibility", icon: BarChart3, label: "Visibility" },
        { to: "/pharmacy/settings", icon: Settings, label: "Settings" },
      ]}>
      <Outlet />
    </StaffFrame>
  ),
});
