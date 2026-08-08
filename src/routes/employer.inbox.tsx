import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";
import { StaffNotifications } from "@/components/StaffNotifications";

export const Route = createFileRoute("/employer/inbox")({
  head: () => ({
    meta: [
      { title: "Employer inbox · Sihha" },
      { name: "description", content: "Compliance alerts and platform advisories for Sihha employer administrators." },
      { property: "og:title", content: "Employer inbox · Sihha" },
      { property: "og:description", content: "Compliance alerts and platform advisories for Sihha employer administrators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AdminShell>
      <StaffNotifications heading="Inbox" blurb="Compliance alerts and platform advisories for your company. " />
    </AdminShell>
  ),
});
