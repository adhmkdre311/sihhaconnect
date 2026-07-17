import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useLang, LANGUAGES, type Lang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/app/profile")({ component: Profile });

function Profile() {
  const { t, lang, setLang } = useLang();
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [emergency, setEmergency] = useState("");
  const [employer, setEmployer] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    void supabase.from("profiles").select("full_name, phone_number, emergency_contact, preferred_language, employer:employers(company_name)").eq("id", user.id).single()
      .then(({ data }) => {
        if (!data) return;
        setFullName(data.full_name ?? ""); setPhone(data.phone_number ?? "");
        setEmergency(data.emergency_contact ?? "");
        const emp = data.employer as unknown as { company_name?: string } | null;
        setEmployer(emp?.company_name ?? "");
        if (data.preferred_language) setLang(data.preferred_language as Lang);
      });
  }, [user, setLang]);

  async function save() {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      full_name: fullName, phone_number: phone, emergency_contact: emergency, preferred_language: lang,
    }).eq("id", user.id);
    setBusy(false);
    if (error) toast.error(error.message); else toast.success(t("saved"));
  }

  return (
    <AppShell title={t("profile")}>
      <div className="space-y-3">
        <div><Label>{t("full_name")}</Label><Input value={fullName} onChange={(e)=>setFullName(e.target.value)} /></div>
        <div><Label>{t("phone")}</Label><Input value={phone} onChange={(e)=>setPhone(e.target.value)} /></div>
        <div><Label>Emergency contact</Label><Input value={emergency} onChange={(e)=>setEmergency(e.target.value)} /></div>
        {employer && <div className="text-xs text-muted-foreground">Employer: <span className="font-medium">{employer}</span></div>}
        <div>
          <Label>{t("language")}</Label>
          <div className="mt-1 flex flex-wrap gap-2">
            {LANGUAGES.map((l) => (
              <button key={l.code} onClick={()=>setLang(l.code)} aria-pressed={lang===l.code} className={`rounded-full border px-3 py-1 text-xs ${lang===l.code?"border-primary bg-primary text-primary-foreground":""}`}>
                {l.native}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={save} disabled={busy} className="w-full">{busy ? t("saving") : t("save")}</Button>
        <Button variant="outline" onClick={async () => { await signOut(); nav({ to: "/" }); }} className="w-full">{t("logout")}</Button>
      </div>
    </AppShell>
  );
}
