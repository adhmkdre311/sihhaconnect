import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { useLang } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { sendBroadcast } from "@/lib/roles.functions";

export const Route = createFileRoute("/employer/notifications")({ component: EmpNotifs });

function EmpNotifs() {
  const { t } = useLang();
  const [subject, setSubject] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const run = useServerFn(sendBroadcast);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { const r = await run({ data: { title: subject, content: msg } }); toast.success(`Sent to ${r.sent} workers`); setSubject(""); setMsg(""); }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <AdminShell>
      <h1 className="mb-4 text-xl font-semibold">{t("broadcast")}</h1>
      <form onSubmit={submit} className="max-w-xl space-y-3 rounded-2xl border bg-card p-5">
        <div><Label>{t("subject")}</Label><Input value={subject} onChange={(e)=>setSubject(e.target.value)} required /></div>
        <div><Label>{t("message")}</Label><Textarea value={msg} onChange={(e)=>setMsg(e.target.value)} rows={5} required /></div>
        <Button type="submit" disabled={busy}>{busy?t("saving"):t("send")}</Button>
        <p className="text-xs text-muted-foreground">Sent as in-app notification to every worker in your roster.</p>
      </form>
    </AdminShell>
  );
}
