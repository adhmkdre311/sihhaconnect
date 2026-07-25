import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  listAnnouncements, createAnnouncement, setAnnouncementPublished,
  deleteAnnouncement, listEmployersLite,
} from "@/lib/announcements.functions";

export const Route = createFileRoute("/admin/announcements")({ component: Page });

const AUDIENCES = ["all", "workers", "employers", "clinics", "pharmacies"] as const;
type Audience = typeof AUDIENCES[number];
type StatusFilter = "all" | "published" | "draft";
type AudienceFilter = "any" | Audience;

function Page() {
  const list = useServerFn(listAnnouncements);
  const create = useServerFn(createAnnouncement);
  const setPub = useServerFn(setAnnouncementPublished);
  const del = useServerFn(deleteAnnouncement);
  const emps = useServerFn(listEmployersLite);
  const qc = useQueryClient();

  const [status, setStatus] = useState<StatusFilter>("all");
  const [audFilter, setAudFilter] = useState<AudienceFilter>("any");
  const q = useQuery({
    queryKey: ["admin-announcements", status, audFilter],
    queryFn: () => list({ data: { status, audience: audFilter } }),
  });
  const qEmps = useQuery({ queryKey: ["admin-employers-lite"], queryFn: () => emps({}) });

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [employerId, setEmployerId] = useState<string>("");
  const [publish, setPublish] = useState(true);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-announcements"] });

  const mCreate = useMutation({
    mutationFn: () => create({ data: {
      title, body, audience,
      employerId: audience === "workers" && employerId ? employerId : null,
      publish,
    }}),
    onSuccess: () => {
      toast.success(publish ? "Announcement published" : "Draft saved");
      setTitle(""); setBody(""); setEmployerId("");
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const mToggle = useMutation({
    mutationFn: (v: { id: string; published: boolean }) => setPub({ data: v }),
    onSuccess: invalidate,
  });
  const mDelete = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); invalidate(); },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Announcements</h1>
        <p className="text-sm text-muted-foreground">Create, publish, and target announcements by audience.</p>
      </div>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="mb-3 font-medium">New announcement</h2>
        <div className="grid gap-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </div>
          <div>
            <Label>Body</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={4000} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Audience</Label>
              <select
                className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
                value={audience}
                onChange={(e) => setAudience(e.target.value as Audience)}
              >
                {AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            {audience === "workers" && (
              <div>
                <Label>Employer (optional)</Label>
                <select
                  className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
                  value={employerId}
                  onChange={(e) => setEmployerId(e.target.value)}
                >
                  <option value="">All employers</option>
                  {(qEmps.data ?? []).map((e) => (
                    <option key={e.id} value={e.id}>{e.company_name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
            Publish immediately
          </label>
          <div>
            <Button onClick={() => mCreate.mutate()} disabled={!title || !body || mCreate.isPending}>
              {mCreate.isPending ? "Saving…" : publish ? "Publish" : "Save draft"}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="font-medium">All announcements</h2>
          <div className="ms-auto flex gap-2 text-sm">
            <select
              className="rounded-md border bg-background p-2"
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
            >
              <option value="all">All statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
            <select
              className="rounded-md border bg-background p-2"
              value={audFilter}
              onChange={(e) => setAudFilter(e.target.value as AudienceFilter)}
            >
              <option value="any">Any audience</option>
              {AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {q.data && q.data.length === 0 && (
          <p className="text-sm text-muted-foreground">No announcements match these filters.</p>
        )}
        <ul className="divide-y">
          {(q.data ?? []).map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{r.title}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${r.published ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {r.published ? "Published" : "Draft"}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{r.audience}</span>
                  {r.employer_name && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{r.employer_name}</span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost"
                  onClick={() => mToggle.mutate({ id: r.id, published: !r.published })}
                  disabled={mToggle.isPending}>
                  {r.published ? "Unpublish" : "Publish"}
                </Button>
                <Button size="sm" variant="ghost"
                  onClick={() => { if (confirm("Delete this announcement?")) mDelete.mutate(r.id); }}
                  disabled={mDelete.isPending}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}