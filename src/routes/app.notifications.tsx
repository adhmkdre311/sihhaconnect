import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useWorkerNotifications } from "@/hooks/useWorkerNotifications";
import { useFormat } from "@/lib/format";
import { Bell } from "lucide-react";

export const Route = createFileRoute("/app/notifications")({ component: Notifs });

function Notifs() {
  const { t } = useLang();
  const { user } = useAuth();
  const fmt = useFormat();
  const { items } = useWorkerNotifications(user?.id, { markRead: true });
  return (
    <AppShell title={t("notifications")}>
      {items.length === 0 && <div className="text-sm text-muted-foreground">—</div>}
      <ul className="space-y-2">
        {items.map((n) => (
          <li key={n.id} className="rounded-xl border bg-card p-3">
            <div className="flex items-center gap-2 text-sm font-medium"><Bell className="h-4 w-4 text-primary" />{n.title ?? n.type}</div>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{n.content}</p>
            <div className="mt-1 text-[10px] text-muted-foreground">{fmt.dateTime(n.sent_at)}</div>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
