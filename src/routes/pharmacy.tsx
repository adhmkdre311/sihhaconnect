import { createFileRoute, Outlet } from "@tanstack/react-router";
import { StaffFrame } from "@/components/StaffFrame";
import { Package } from "lucide-react";

export const Route = createFileRoute("/pharmacy")({
  component: () => (
    <StaffFrame role="pharmacy_staff" roleLabel="Pharmacy hub"
      items={[{ to: "/pharmacy", icon: Package, label: "Stock" }]}>
      <Outlet />
    </StaffFrame>
  ),
});