import { createFileRoute } from "@tanstack/react-router";
import { StaffNotifications } from "@/components/StaffNotifications";

export const Route = createFileRoute("/pharmacy/notifications")({
  head: () => ({
    meta: [
      { title: "Pharmacy notifications · Sihha" },
      { name: "description", content: "Availability reminders and platform advisories for Sihha pharmacy partners." },
      { property: "og:title", content: "Pharmacy notifications · Sihha" },
      { property: "og:description", content: "Availability reminders and platform advisories for Sihha pharmacy partners." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <StaffNotifications blurb="Availability reminders and platform advisories. " />,
});
