// E1: employer roster data hook (invite code + worker list + search).
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type WorkerRow = {
  id: string; full_name: string | null; phone_number: string | null;
  preferred_language: string; is_active: boolean; created_at: string;
};

export function useEmployerWorkers(userId: string | undefined) {
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const reload = useCallback(async () => {
    if (!userId) return;
    const { data: role } = await supabase.from("user_roles")
      .select("employer_id").eq("user_id", userId).eq("role", "employer_admin").maybeSingle();
    if (!role?.employer_id) { setLoading(false); return; }
    const { data: emp } = await supabase.from("employers")
      .select("invite_code").eq("id", role.employer_id).single();
    setInviteCode(emp?.invite_code ?? "");
    const { data: ws } = await supabase.from("profiles")
      .select("id, full_name, phone_number, preferred_language, is_active, created_at")
      .eq("employer_id", role.employer_id)
      .order("created_at", { ascending: false });
    setWorkers((ws ?? []) as WorkerRow[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { void reload(); }, [reload]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter((w) =>
      (w.full_name ?? "").toLowerCase().includes(q) || (w.phone_number ?? "").toLowerCase().includes(q));
  }, [workers, query]);

  return { workers, filtered, inviteCode, loading, query, setQuery, reload };
}
