// M2: shared notifications inbox for clinic / employer / pharmacy / insurer staff.
import { useAuth } from "@/lib/auth";
import { useWorkerNotifications } from "@/hooks/useWorkerNotifications";
import { useFormat } from "@/lib/format";
import { Bell, BellOff } from "lucide-react";

export function StaffNotifications({ heading = "Notifications", blurb }: { heading?: string; blurb?: string }) {
  const { user } = useAuth();
  const fmt = useFormat();
  const { items, unread, loading } = useWorkerNotifications(user?.id, { markRead: true });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">{heading}</h1>
        <p className="text-sm text-muted-foreground">
          {blurb ?? "Platform advisories, approvals and alerts for your account."}
          {unread > 0 && <span className="ms-1 font-medium text-primary">{unread} new</span>}
        </p>
      </div>
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && items.length === 0 && (
        <div className="flex items-center gap-2 rounded-2xl border border-dashed bg-card p-6 text-sm text-muted-foreground">
          <BellOff className="h-4 w-4" /> Nothing here yet.
        </div>
      )}
      <ul className="space-y-2">
        {items.map((n) => (
          <li key={n.id} className={`rounded-2xl border bg-card p-4 ${n.read_at ? "" : "border-primary/40"}`}>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Bell className="h-4 w-4 text-primary" />{n.title ?? n.type.replace(/_/g, " ")}
            </div>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{n.content}</p>
            <div className="mt-1 text-[10px] text-muted-foreground">{fmt.dateTime(n.sent_at)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
