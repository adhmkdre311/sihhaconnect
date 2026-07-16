import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { bootstrapWorker, bootstrapEmployer, bootstrapClinicStaff } from "@/lib/roles.functions";
import { useServerFn } from "@tanstack/react-start";

const search = z.object({
  role: z.enum(["worker","employer_admin","clinic_staff"]).default("worker"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => search.parse(s),
  component: AuthPage,
});

function AuthPage() {
  const { role } = Route.useSearch();
  const { t, lang } = useLang();
  const { refreshRoles } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"login"|"signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [clinicId, setClinicId] = useState("");
  const [clinics, setClinics] = useState<{id:string;name:string}[]>([]);
  const [busy, setBusy] = useState(false);

  const runBootstrapWorker = useServerFn(bootstrapWorker);
  const runBootstrapEmployer = useServerFn(bootstrapEmployer);
  const runBootstrapClinic = useServerFn(bootstrapClinicStaff);

  useEffect(() => {
    if (role === "clinic_staff") {
      void supabase.from("clinics").select("id,name").then(({ data }) => setClinics(data ?? []));
    }
  }, [role]);

  const targetFor = () =>
    role === "worker" ? "/app" : role === "employer_admin" ? "/employer" : "/clinic";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await refreshRoles();
        toast.success("Welcome back");
        nav({ to: targetFor() });
        return;
      }
      // signup
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName, preferred_language: lang } },
      });
      if (error) throw error;
      if (!data.session) {
        // If email confirmation required, ask user to check email — but bootstrap needs session.
        const { error: sErr } = await supabase.auth.signInWithPassword({ email, password });
        if (sErr) throw sErr;
      }
      if (role === "worker") {
        await runBootstrapWorker({ data: { fullName, phoneNumber: phone, preferredLanguage: lang, inviteCode: inviteCode || undefined } });
      } else if (role === "employer_admin") {
        await runBootstrapEmployer({ data: { fullName, companyName } });
      } else {
        if (!clinicId) throw new Error("Choose a clinic");
        await runBootstrapClinic({ data: { fullName, clinicId } });
      }
      await refreshRoles();
      toast.success("Account ready");
      nav({ to: targetFor() });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  const heading =
    role === "worker" ? t("worker") :
    role === "employer_admin" ? t("employer_admin") : t("clinic_staff");

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-md">
        <Button variant="ghost" onClick={() => nav({ to: "/" })} className="mb-4">← {t("back")}</Button>
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold">{heading}</h1>
          <p className="mb-4 text-sm text-muted-foreground">{mode === "login" ? t("login") : t("signup")}</p>

          <div className="mb-4 flex rounded-lg border p-1 text-sm">
            <button type="button" onClick={()=>setMode("signup")} className={`flex-1 rounded-md px-3 py-1.5 ${mode==="signup"?"bg-primary text-primary-foreground":""}`}>{t("signup")}</button>
            <button type="button" onClick={()=>setMode("login")} className={`flex-1 rounded-md px-3 py-1.5 ${mode==="login"?"bg-primary text-primary-foreground":""}`}>{t("login")}</button>
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <div><Label>{t("full_name")}</Label><Input value={fullName} onChange={(e)=>setFullName(e.target.value)} required /></div>
            )}
            <div><Label>{t("email")}</Label><Input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required /></div>
            <div><Label>{t("password")}</Label><Input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required minLength={6} /></div>
            {mode === "signup" && role === "worker" && (
              <>
                <div><Label>{t("phone")}</Label><Input type="tel" value={phone} onChange={(e)=>setPhone(e.target.value)} placeholder="+974 …" required /></div>
                <div>
                  <Label>{t("invite_code")}</Label>
                  <Input value={inviteCode} onChange={(e)=>setInviteCode(e.target.value)} placeholder="e.g. ACME-2026" />
                  <p className="mt-1 text-xs text-muted-foreground">Ask your HR or supervisor for your company's code — it links your account to your employer.</p>
                </div>
              </>
            )}
            {mode === "signup" && role === "employer_admin" && (
              <div><Label>Company</Label><Input value={companyName} onChange={(e)=>setCompanyName(e.target.value)} required /></div>
            )}
            {mode === "signup" && role === "clinic_staff" && (
              <div>
                <Label>Clinic</Label>
                <select className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" value={clinicId} onChange={(e)=>setClinicId(e.target.value)} required>
                  <option value="">—</option>
                  {clinics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <Button type="submit" disabled={busy} className="w-full">{busy ? t("loading") : mode === "login" ? t("login") : t("signup")}</Button>
          </form>
        </div>
      </div>
    </div>
  );
}
