import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ClinicShell } from "@/components/ClinicShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { LANGUAGES } from "@/lib/i18n";
import { useServerFn } from "@tanstack/react-start";
import {
  getMyClinicPerms, listClinicTeam, inviteClinicStaff,
  revokeClinicInvite, updateClinicStaffPermissions, removeClinicStaff,
} from "@/lib/clinicStaff.functions";
import { Trash2, Mail, Copy } from "lucide-react";

export const Route = createFileRoute("/clinic/settings")({ component: Settings });

type Perms = { can_view_queue: boolean; can_edit_slots: boolean; can_add_documents: boolean; can_manage_staff: boolean };
type Staff = Perms & { user_id: string; is_self: boolean; profile: { full_name: string | null; email: string | null } | null };
type Invite = Perms & { id: string; email: string; token: string; status: string; expires_at: string; accepted_at: string | null; created_at: string };
const DEFAULT_PERMS: Perms = { can_view_queue: true, can_edit_slots: false, can_add_documents: false, can_manage_staff: false };

function Settings() {
  const { user } = useAuth();
  const [clinicId, setClinicId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", address: "", phone: "", hours: "",
    departments: "" as string, languages: [] as string[],
  });

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: role } = await supabase.from("user_roles").select("clinic_id").eq("user_id", user.id).eq("role","clinic_staff").maybeSingle();
      if (!role?.clinic_id) return;
      setClinicId(role.clinic_id);
      const { data: c } = await supabase.from("clinics").select("name, address, phone, departments, languages_supported_onsite").eq("id", role.clinic_id).single();
      if (c) setForm({
        name: c.name ?? "",
        address: c.address ?? "",
        phone: c.phone ?? "",
        hours: "",
        departments: (c.departments ?? []).join(", "),
        languages: c.languages_supported_onsite ?? [],
      });
    })();
  }, [user]);

  const toggleLang = (code: string) => {
    setForm(f => ({ ...f, languages: f.languages.includes(code) ? f.languages.filter(l=>l!==code) : [...f.languages, code] }));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicId) return;
    setSaving(true);
    const departments = form.departments.split(",").map(s=>s.trim()).filter(Boolean);
    const { error } = await supabase.from("clinics").update({
      name: form.name, address: form.address, phone: form.phone,
      departments, languages_supported_onsite: form.languages,
    }).eq("id", clinicId);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Saved");
  };

  return (
    <ClinicShell>
      <h1 className="mb-4 text-xl font-semibold">Clinic settings</h1>
      <form onSubmit={save} className="max-w-2xl space-y-4 rounded-2xl border bg-card p-6">
        <div><Label>Name</Label><Input value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} required /></div>
        <div><Label>Address</Label><Input value={form.address} onChange={(e)=>setForm({...form, address:e.target.value})} /></div>
        <div><Label>Phone</Label><Input value={form.phone} onChange={(e)=>setForm({...form, phone:e.target.value})} /></div>
        <div><Label>Hours</Label><Textarea rows={2} value={form.hours} onChange={(e)=>setForm({...form, hours:e.target.value})} placeholder="e.g. Sun–Thu 8am–8pm" /></div>
        <div><Label>Departments (comma-separated)</Label><Input value={form.departments} onChange={(e)=>setForm({...form, departments:e.target.value})} placeholder="general, dental, dermatology" /></div>
        <div>
          <Label>Languages spoken on-site</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {LANGUAGES.map(l => (
              <button type="button" key={l.code} onClick={()=>toggleLang(l.code)}
                className={`chip ${form.languages.includes(l.code) ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {l.flag} {l.native}
              </button>
            ))}
          </div>
        </div>
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
      </form>
      <TeamSection />
    </ClinicShell>
  );
}

const PERM_LABELS: [keyof Perms, string][] = [
  ["can_view_queue", "View queue"],
  ["can_edit_slots", "Edit slots"],
  ["can_add_documents", "Add documents"],
  ["can_manage_staff", "Manage staff"],
];

function TeamSection() {
  const getPerms = useServerFn(getMyClinicPerms);
  const listTeam = useServerFn(listClinicTeam);
  const invite = useServerFn(inviteClinicStaff);
  const revoke = useServerFn(revokeClinicInvite);
  const updatePerms = useServerFn(updateClinicStaffPermissions);
  const removeStaff = useServerFn(removeClinicStaff);

  const [canManage, setCanManage] = useState<boolean | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [newPerms, setNewPerms] = useState<Perms>(DEFAULT_PERMS);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const me = await getPerms();
    if (!me?.can_manage_staff) { setCanManage(false); return; }
    setCanManage(true);
    const r = await listTeam();
    setStaff(r.staff as Staff[]);
    setInvites(r.invites as Invite[]);
  };
  useEffect(() => { void reload(); }, []);

  if (canManage === null) return null;
  if (canManage === false) {
    return (
      <div className="mt-8 max-w-2xl rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
        Ask a clinic manager for the "Manage staff" permission to invite teammates.
      </div>
    );
  }

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await invite({ data: { email, perms: newPerms } });
      toast.success("Invitation sent");
      try { await navigator.clipboard.writeText(r.link); } catch { /* noop */ }
      setEmail(""); setNewPerms(DEFAULT_PERMS);
      await reload();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to send invite"); }
    finally { setBusy(false); }
  };

  const togglePerm = async (s: Staff, key: keyof Perms) => {
    const next: Perms = { can_view_queue: s.can_view_queue, can_edit_slots: s.can_edit_slots, can_add_documents: s.can_add_documents, can_manage_staff: s.can_manage_staff, [key]: !s[key] } as Perms;
    try {
      await updatePerms({ data: { userId: s.user_id, perms: next } });
      await reload();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  };

  return (
    <div className="mt-8 max-w-3xl space-y-6">
      <div className="rounded-2xl border bg-card p-6">
        <h2 className="mb-1 text-lg font-semibold">Invite a teammate</h2>
        <p className="mb-4 text-xs text-muted-foreground">They'll receive an email with a link to join this clinic with the permissions you set.</p>
        <form onSubmit={sendInvite} className="space-y-3">
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required placeholder="colleague@example.com" />
          </div>
          <div>
            <Label>Permissions</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {PERM_LABELS.map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                  <input type="checkbox" checked={newPerms[key]} onChange={(e)=>setNewPerms({...newPerms, [key]: e.target.checked})} />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={busy}><Mail className="mr-2 h-4 w-4" />{busy ? "Sending…" : "Send invitation"}</Button>
        </form>
      </div>

      {invites.length > 0 && (
        <div className="rounded-2xl border bg-card p-6">
          <h2 className="mb-3 text-lg font-semibold">Invitations</h2>
          <ul className="space-y-2">
            {invites.map(i => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                <div>
                  <div className="font-medium">{i.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {i.status} · {PERM_LABELS.filter(([k])=>i[k]).map(([,l])=>l).join(", ") || "no permissions"} · expires {new Date(i.expires_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-2">
                  {i.status === "pending" && (
                    <>
                      <Button size="sm" variant="outline" onClick={async ()=>{ try { await navigator.clipboard.writeText(`${window.location.origin}/clinic/accept-invite?token=${i.token}`); toast.success("Invite link copied"); } catch { /* noop */ } }}>
                        <Copy className="mr-1 h-3 w-3" />Copy link
                      </Button>
                      <Button size="sm" variant="ghost" onClick={async ()=>{ await revoke({ data: { inviteId: i.id } }); toast.success("Revoked"); await reload(); }}>Revoke</Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border bg-card p-6">
        <h2 className="mb-3 text-lg font-semibold">Team</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-2">Member</th>
                {PERM_LABELS.map(([k,l])=><th key={k} className="p-2 text-center">{l}</th>)}
                <th />
              </tr>
            </thead>
            <tbody>
              {staff.map(s => (
                <tr key={s.user_id} className="border-b last:border-0">
                  <td className="p-2">
                    <div className="font-medium">{s.profile?.full_name ?? "—"} {s.is_self && <span className="text-xs text-muted-foreground">(you)</span>}</div>
                    <div className="text-xs text-muted-foreground">{s.profile?.email}</div>
                  </td>
                  {PERM_LABELS.map(([key]) => (
                    <td key={key} className="p-2 text-center">
                      <input type="checkbox" checked={s[key]} onChange={()=>togglePerm(s, key)} />
                    </td>
                  ))}
                  <td className="p-2 text-right">
                    {!s.is_self && (
                      <button aria-label="remove" onClick={async ()=>{
                        if (!confirm("Remove this staff member from your clinic?")) return;
                        try { await removeStaff({ data: { userId: s.user_id } }); toast.success("Removed"); await reload(); }
                        catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
                      }}><Trash2 className="h-4 w-4 text-destructive" /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}