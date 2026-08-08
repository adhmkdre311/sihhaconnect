// M7: persistent banner while a platform admin is in read-only view-as mode.
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Eye } from "lucide-react";
import { setViewAs, type ViewAsRole } from "@/lib/viewAs";
import { recordViewAs } from "@/lib/viewAs.functions";

const LABELS: Record<ViewAsRole, string> = {
  clinic_staff: "Clinic staff", employer_admin: "Employer admin",
  pharmacy_staff: "Pharmacy staff", insurance_staff: "Insurance staff", worker: "Worker",
};

export function ViewAsBanner({ role }: { role: ViewAsRole }) {
  const nav = useNavigate();
  const log = useServerFn(recordViewAs);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-accent px-4 py-2 text-sm text-accent-foreground">
      <span className="flex items-center gap-2 font-medium">
        <Eye className="h-4 w-4" /> Read-only support view — viewing as {LABELS[role]}. Every action is disabled and this session is audited.
      </span>
      <button
        className="rounded-md bg-accent-foreground/10 px-3 py-1 font-medium underline"
        onClick={() => {
          void log({ data: { role, action: "stop" } }).catch(() => undefined);
          setViewAs(null);
          nav({ to: "/admin/users" });
        }}
      >
        Exit view-as
      </button>
    </div>
  );
}
