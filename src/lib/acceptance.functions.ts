import { createServerFn } from "@tanstack/react-start";

export type AcceptanceResult = {
  name: string;
  status: "pass" | "fail" | "skip";
  detail?: string;
  ms: number;
};

export type AcceptanceRun = {
  id: string;
  ok: boolean;
  passed: number;
  failed: number;
  skipped: number;
  total_ms: number;
  source: string;
  created_at: string;
  results: AcceptanceResult[];
};

/** Latest persisted acceptance run (public, non-sensitive test metadata). */
export const getLatestAcceptanceRun = createServerFn({ method: "GET" }).handler(
  async (): Promise<AcceptanceRun | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("acceptance_runs")
      .select("id, ok, passed, failed, skipped, total_ms, source, created_at, results")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return { ...data, results: (data.results ?? []) as AcceptanceResult[] } as AcceptanceRun;
  },
);
