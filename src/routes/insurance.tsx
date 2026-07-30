import { createFileRoute, Outlet } from "@tanstack/react-router";
import { StaffFrame } from "@/components/StaffFrame";
import { BarChart3, FileText } from "lucide-react";

export const Route = createFileRoute("/insurance")({
  component: () => (
    <StaffFrame role="insurance_staff" roleLabel="Insurance portal"
      items={[
        { to: "/insurance", icon: BarChart3, label: "Aggregates" },
        { to: "/insurance/claims", icon: FileText, label: "Claims" },
      ]}>
      <Outlet />
    </StaffFrame>
  ),
});