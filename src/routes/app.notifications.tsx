import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Bell } from "lucide-react";

export const Route = createFileRoute("/app/notifications")({ component: Notifs });

type N = { id: string; title: string | null; content: string; sent_at: string; type: string; read_at: string | null };

function Notifs() {
  const { t } = useLang();
  const { user } = useAuth();
  const [items, setItems] = useState<N[]>([]);
  useEffect(() => {
    if (!user) return;
    void supabase.from("notifications")
      .select("id, title, content, sent_at, type, read_at, worker_id, employer_id")
      .or(`worker_id.eq.${user.id},worker_id.is.null`)
      .order("sent_at", { ascending: false }).limit(100)
      .then(async ({ data }) => {
        setItems((data ?? []) as N[]);
        void supabase.from("notifications").update({ read_at: new Date().toISOString() })
          .eq("worker_id", user.id).is("read_at", null);
      });
  }, [user]);
  return (
    <AppShell title={t("notifications")}>
      {items.length === 0 && <div className="text-sm text-muted-foreground">—</div>}
      <ul className="space-y-2">
        {items.map((n) => (
          <li key={n.id} className="rounded-xl border bg-card p-3">
            <div className="flex items-center gap-2 text-sm font-medium"><Bell className="h-4 w-4 text-primary" />{n.title ?? n.type}</div>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{n.content}</p>
            <div className="mt-1 text-[10px] text-muted-foreground">{new Date(n.sent_at).toLocaleString()}</div>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
