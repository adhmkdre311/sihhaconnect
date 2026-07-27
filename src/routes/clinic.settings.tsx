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

export const Route = createFileRoute("/clinic/settings")({ component: Settings });

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
    </ClinicShell>
  );
}