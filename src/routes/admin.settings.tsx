import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listPlatformSettings, updatePlatformSetting } from "@/lib/adminConsole.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/settings")({ component: Settings });

function Settings() {
  const load = useServerFn(listPlatformSettings);
  const save = useServerFn(updatePlatformSetting);
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["admin-settings"], queryFn: () => load({}) });
  const m = useMutation({
    mutationFn: (v: { key: string; value: unknown }) => save({ data: v }),
    onSuccess: () => { setErr(null); qc.invalidateQueries({ queryKey: ["admin-settings"] }); },
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold">Platform settings</h1>
        <p className="text-sm text-muted-foreground">Feature flags, languages, and guardrail version. Changes are audited.</p>
      </div>
      {err && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{err}</p>}
      <div className="space-y-3">
        {(q.data ?? []).map((s) => {
          const isBool = typeof s.value === "boolean";
          const text = draft[s.key] ?? JSON.stringify(s.value);
          return (
            <div key={s.key} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{s.key.replace(/_/g, " ")}</p>
                  <p className="text-xs text-muted-foreground">Updated {new Date(s.updated_at).toLocaleString()}</p>
                </div>
                {isBool ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={s.value as boolean}
                      disabled={m.isPending}
                      onChange={(e) => m.mutate({ key: s.key, value: e.target.checked })}
                    />
                    {(s.value as boolean) ? "Enabled" : "Disabled"}
                  </label>
                ) : (
                  <div className="flex w-full max-w-md gap-2">
                    <input
                      className="flex-1 rounded-md border bg-background p-2 text-sm font-mono"
                      value={text}
                      onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })}
                    />
                    <Button
                      size="sm"
                      disabled={m.isPending}
                      onClick={() => {
                        try {
                          m.mutate({ key: s.key, value: JSON.parse(text) });
                        } catch {
                          setErr(`${s.key}: value must be valid JSON (e.g. "en" or ["en","ar"]).`);
                        }
                      }}
                    >
                      Save
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      </div>
    </div>
  );
}