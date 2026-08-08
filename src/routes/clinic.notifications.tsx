import { createFileRoute } from "@tanstack/react-router";
import { ClinicShell } from "@/components/ClinicShell";
import { StaffNotifications } from "@/components/StaffNotifications";

export const Route = createFileRoute("/clinic/notifications")({
  head: () => ({
    meta: [
      { title: "Clinic notifications · Sihha" },
      { name: "description", content: "Advisories, approvals and appointment alerts for Sihha clinic staff." },
      { property: "og:title", content: "Clinic notifications · Sihha" },
      { property: "og:description", content: "Advisories, approvals and appointment alerts for Sihha clinic staff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ClinicShell>
      <StaffNotifications blurb="Platform advisories and alerts for your clinic account. " />
    </ClinicShell>
  ),
});
