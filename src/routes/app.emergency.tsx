import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useLang } from "@/lib/i18n";
import { Phone, AlertTriangle, MapPin } from "lucide-react";

export const Route = createFileRoute("/app/emergency")({ component: Emergency });

function Emergency() {
  const { t } = useLang();
  return (
    <AppShell title={t("emergency")}>
      <a href="tel:999" className="mb-3 flex items-center justify-between rounded-2xl bg-destructive p-5 text-destructive-foreground shadow">
        <div>
          <div className="text-xs uppercase opacity-80">{t("emergency_number")}</div>
          <div className="text-2xl font-bold">999</div>
        </div>
        <Phone className="h-8 w-8" />
      </a>
      <div className="mb-3 flex items-start gap-2 rounded-2xl border bg-card p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-accent" />
        <p className="text-sm">{t("heat_warning")}</p>
      </div>
      <a href="https://maps.google.com/?q=hospital+near+me" target="_blank" rel="noopener" className="flex items-center gap-2 rounded-2xl border bg-card p-4">
        <MapPin className="h-5 w-5 text-primary" />
        <div>
          <div className="text-sm font-medium">{t("nearest_hospital")}</div>
          <div className="text-xs text-muted-foreground">Open in Maps</div>
        </div>
      </a>
    </AppShell>
  );
}
