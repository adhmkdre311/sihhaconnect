// M1: create, share, and revoke worker onboarding links.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createEmployerInvite, listEmployerInvites, revokeEmployerInvite } from "@/lib/employerInvites.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormat } from "@/lib/format";
import { Copy, Link2, Ban } from "lucide-react";
import { toast } from "sonner";

function linkFor(code: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/auth?role=worker&mode=signup&invite=${code}`;
}

export function EmployerInviteLinks() {
  const fmt = useFormat();
  const qc = useQueryClient();
  const list = useServerFn(listEmployerInvites);
  const create = useServerFn(createEmployerInvite);
  const revoke = useServerFn(revokeEmployerInvite);
  const [label, setLabel] = useState("");
  const [days, setDays] = useState("30");
  const [maxUses, setMaxUses] = useState("");

  const q = useQuery({ queryKey: ["employer-invites"], queryFn: () => list() });
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["employer-invites"] });

  const mCreate = useMutation({
    mutationFn: () => create({ data: {
      label: label.trim() || undefined,
      days: Number(days) || 30,
      maxUses: maxUses.trim() ? Number(maxUses) : null,
    } }),
    onSuccess: () => { setLabel(""); setMaxUses(""); toast.success("Invite link created"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mRevoke = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => { toast.success("Revoked"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="mb-6 rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-semibold"><Link2 className="h-4 w-4 text-primary" /> Worker invite links</div>
      <p className="mt-1 text-xs text-muted-foreground">
        Send a link instead of a code — workers who sign up through it are linked to your company automatically.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2"><Label>Label (optional)</Label><Input value={label} onChange={(e)=>setLabel(e.target.value)} placeholder="e.g. Site B crew" /></div>
        <div><Label>Valid for (days)</Label><Input inputMode="numeric" value={days} onChange={(e)=>setDays(e.target.value)} /></div>
        <div><Label>Max uses</Label><Input inputMode="numeric" value={maxUses} onChange={(e)=>setMaxUses(e.target.value)} placeholder="unlimited" /></div>
      </div>
      <Button size="sm" className="mt-3" disabled={mCreate.isPending} onClick={()=>mCreate.mutate()}>
        {mCreate.isPending ? "Creating…" : "Create invite link"}
      </Button>

      <ul className="mt-4 space-y-2">
        {(q.data ?? []).map((i) => {
          const expired = new Date(i.expires_at) <= new Date();
          const used = i.max_uses !== null && i.uses >= i.max_uses;
          const dead = i.revoked || expired || used;
          return (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm">
              <div>
                <div className="flex items-center gap-2">
                  <code className="rounded bg-muted px-2 py-0.5 font-mono">{i.code}</code>
                  {i.label && <span className="text-xs text-muted-foreground">{i.label}</span>}
                  {dead && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {i.revoked ? "revoked" : expired ? "expired" : "used up"}
                  </span>}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {i.uses}{i.max_uses !== null ? ` / ${i.max_uses}` : ""} used · expires {fmt.date(i.expires_at)}
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" disabled={dead} onClick={()=>{ void navigator.clipboard.writeText(linkFor(i.code)); toast.success("Link copied"); }}>
                  <Copy className="me-1 h-4 w-4" />Copy link
                </Button>
                {!i.revoked && (
                  <Button size="sm" variant="ghost" onClick={()=>mRevoke.mutate(i.id)}><Ban className="h-4 w-4" /></Button>
                )}
              </div>
            </li>
          );
        })}
        {!q.isLoading && (q.data ?? []).length === 0 && <li className="text-xs text-muted-foreground">No invite links yet.</li>}
      </ul>
    </section>
  );
}
