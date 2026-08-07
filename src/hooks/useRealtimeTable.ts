// E4: one place that owns Supabase Realtime channel lifecycle.
// Channels are created inside useEffect and torn down on unmount so we never
// leak subscriptions (which would cause a reconnect loop + Realtime billing).
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useRealtimeTable(
  table: string,
  onChange: () => void,
  opts: { enabled?: boolean; filter?: string; channel?: string } = {},
) {
  const { enabled = true, filter, channel } = opts;
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    if (!enabled) return;
    const name = channel ?? `rt-${table}-${filter ?? "all"}`;
    const ch = supabase
      .channel(name)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
        () => cb.current(),
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [table, filter, channel, enabled]);
}
