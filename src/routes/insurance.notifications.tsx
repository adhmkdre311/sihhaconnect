import { createFileRoute } from "@tanstack/react-router";
import { StaffNotifications } from "@/components/StaffNotifications";

export const Route = createFileRoute("/insurance/notifications")({
  head: () => ({
    meta: [
      { title: "Insurer notifications · Sihha" },
      { name: "description", content: "Aggregated network advisories and platform notices for Sihha insurer staff." },
      { property: "og:title", content: "Insurer notifications · Sihha" },
      { property: "og:description", content: "Aggregated network advisories and platform notices for Sihha insurer staff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <StaffNotifications blurb="Network advisories and platform notices. " />,
});
