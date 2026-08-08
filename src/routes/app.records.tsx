import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, AlertTriangle, Camera, FolderOpen, Eye } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { summarizeDocument } from "@/lib/ai.functions";

export const Route = createFileRoute("/app/records")({ component: Records });

type Doc = { id: string; type: string; created_at: string; ai_plain_language_summary: string | null; flagged_for_human_review: boolean; original_file_url: string | null };
type Appt = { id: string; scheduled_at: string; status: string; department: string; clinic: { name: string } | null; visit_summary: string | null };

const DOC_TYPES = ["prescription", "lab_report", "visit_summary", "insurance_form", "other"] as const;
type DocType = (typeof DOC_TYPES)[number];

function Records() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [docType, setDocType] = useState<DocType>("other");
  const summarize = useServerFn(summarizeDocument);

  const reload = () => {
    if (!user) return;
    void supabase.from("documents").select("id, type, created_at, ai_plain_language_summary, flagged_for_human_review, original_file_url")
      .eq("worker_id", user.id).order("created_at",{ascending:false})
      .then(({ data }) => setDocs((data ?? []) as Doc[]));
    void supabase.from("appointments").select("id, scheduled_at, status, department, visit_summary, clinic:clinics(name)")
      .eq("worker_id", user.id).order("scheduled_at", { ascending: false })
      .then(({ data }) => setAppts((data ?? []) as never));
  };
  useEffect(reload, [user]);

  async function uploadAndSummarize(file: File | null, pasted: string) {
    if (!user) return;
    setBusy(true);
    try {
      let url: string | null = null;
      let extracted = pasted;
      if (file) {
        if (file.size > 15 * 1024 * 1024) throw new Error("File is too large (max 15 MB).");
        const path = `${user.id}/${Date.now()}-${file.name}`;
        const up = await supabase.storage.from("documents").upload(path, file, { contentType: file.type || undefined });
        if (up.error) throw up.error;
        url = up.data.path;
        if (!extracted) extracted = `[Uploaded ${file.name}]`;
      }
      const { data: doc, error } = await supabase.from("documents").insert({
        worker_id: user.id, type: docType, original_file_url: url,
      }).select("id").single();
      if (error || !doc) throw error;
      if (extracted.trim()) {
        await summarize({ data: { documentId: doc.id, text: extracted, language: lang } });
      }
      toast.success(t("saved"));
      setText("");
      reload();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  // M3: files live in a private bucket — open through a short-lived signed URL.
  async function openFile(path: string) {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60);
    if (error || !data) { toast.error(error?.message ?? "Could not open file"); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <AppShell title={t("my_records")}>
      <div className="mb-4 rounded-2xl border bg-card p-4">
        <div className="mb-2 text-sm font-medium">{t("upload_document")}</div>
        <div className="mb-2 flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs font-medium">
            <Camera className="h-4 w-4 text-primary" /> Take a photo
            <input type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => void uploadAndSummarize(e.target.files?.[0] ?? null, text)} />
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs font-medium">
            <FolderOpen className="h-4 w-4 text-primary" /> Choose a file
            <input type="file" accept="image/*,application/pdf" className="hidden"
              onChange={(e) => void uploadAndSummarize(e.target.files?.[0] ?? null, text)} />
          </label>
          <select value={docType} onChange={(e) => setDocType(e.target.value as DocType)}
            className="rounded-lg border bg-background px-2 py-2 text-xs">
            {DOC_TYPES.map((d) => <option key={d} value={d}>{d.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <Textarea placeholder="Paste text from the document (temporary until OCR)" rows={3} value={text} onChange={(e)=>setText(e.target.value)} />
        <Button disabled={busy || !text} className="mt-2 w-full" onClick={() => void uploadAndSummarize(null, text)}>
          <Upload className="me-2 h-4 w-4" />{busy ? t("saving") : t("send")}
        </Button>
      </div>

      <h3 className="mb-2 text-sm font-semibold">{t("upcoming")} / {t("past")}</h3>
      <div className="mb-4 space-y-2">
        {appts.map((a) => (
          <div key={a.id} className="rounded-xl border bg-card p-3 text-sm">
            <div className="font-medium">{new Date(a.scheduled_at).toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{a.clinic?.name} · {a.department} · {a.status}</div>
            {a.visit_summary && <div className="mt-2 rounded-md bg-secondary p-2 text-xs">{a.visit_summary}</div>}
          </div>
        ))}
        {appts.length === 0 && <div className="text-xs text-muted-foreground">{t("no_upcoming")}</div>}
      </div>

      <h3 className="mb-2 text-sm font-semibold">Documents</h3>
      <div className="space-y-2">
        {docs.map((d) => (
          <div key={d.id} className="rounded-xl border bg-card p-3">
            <div className="flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4 text-primary" />{d.type}</div>
            {d.flagged_for_human_review && (
              <div className="mt-1 flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="h-3 w-3" />Flagged for review</div>
            )}
            {d.ai_plain_language_summary && (
              <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{d.ai_plain_language_summary}</p>
            )}
            {d.original_file_url && (
              <Button size="sm" variant="ghost" className="mt-2" onClick={() => void openFile(d.original_file_url!)}>
                <Eye className="me-1 h-4 w-4" /> View file
              </Button>
            )}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
