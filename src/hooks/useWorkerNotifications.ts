// E1 + E4: worker notification feed with live updates and read receipts.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";

export type NotificationRow = {
  id: string; title: string | null; content: string;
  sent_at: string; type: string; read_at: string | null;
};

export function useWorkerNotifications(userId: string | undefined, opts: { markRead?: boolean } = {}) {
  const { markRead = false } = opts;
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, title, content, sent_at, type, read_at, worker_id, employer_id")
      .or(`worker_id.eq.${userId},worker_id.is.null`)
      .order("sent_at", { ascending: false })
      .limit(100);
    setItems((data ?? []) as NotificationRow[]);
    setLoading(false);
    if (markRead) {
      void supabase.from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("worker_id", userId).is("read_at", null);
    }
  }, [userId, markRead]);

  useEffect(() => { void reload(); }, [reload]);
  useRealtimeTable("notifications", () => { void reload(); }, {
    enabled: Boolean(userId),
    filter: userId ? `worker_id=eq.${userId}` : undefined,
  });

  const unread = items.filter((n) => !n.read_at).length;
  return { items, unread, loading, reload };
}
