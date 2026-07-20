import { createFileRoute, Outlet } from "@tanstack/react-router";
import { StaffFrame } from "@/components/StaffFrame";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/insurance")({
  component: () => (
    <StaffFrame role="insurance_staff" roleLabel="Insurance portal"
      items={[{ to: "/insurance", icon: BarChart3, label: "Aggregates" }]}>
      <Outlet />
    </StaffFrame>
  ),
});