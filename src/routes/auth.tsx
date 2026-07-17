import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/ui/field";
import { toast } from "sonner";
import { bootstrapWorker, bootstrapEmployer, bootstrapClinicStaff } from "@/lib/roles.functions";
import { useServerFn } from "@tanstack/react-start";
import { mapAuthError } from "@/lib/authErrors";

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

  // BUG-03/10: field-level errors keyed by field name; wired to Field's aria-describedby.
  // Full validation is added in Task 7; placeholder shape kept empty until then.
  const fieldErrors: Partial<Record<"name" | "email" | "password" | "phone" | "company" | "invite" | "clinic", string>> = {};

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
      // BUG-10: never render raw Supabase error text; use translated map.
      toast.error(mapAuthError(err, t));
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
              <Field
                label={t("name_label")}
                name="name"
                autoComplete="name"
                dir="auto"
                maxLength={100}
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                error={fieldErrors.name}
              />
            )}
            <Field
              label={t("email_label")}
              type="email"
              name="email"
              autoComplete="email"
              dir="ltr"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldErrors.email}
            />
            <Field
              label={t("password_label")}
              type="password"
              name={mode === "signup" ? "new-password" : "current-password"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              dir="ltr"
              minLength={8}
              required
              hint={mode === "signup" ? t("password_hint") : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
            />
            {mode === "signup" && role === "worker" && (
              <>
                <Field
                  label={t("phone_label")}
                  type="tel"
                  name="tel"
                  autoComplete="tel"
                  dir="ltr"
                  placeholder="+974 …"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  error={fieldErrors.phone}
                />
                <Field
                  label={t("invite_code")}
                  name="invite-code"
                  autoComplete="off"
                  dir="ltr"
                  placeholder="e.g. ACME-2026"
                  hint={t("invite_code_help")}
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  error={fieldErrors.invite}
                />
              </>
            )}
            {mode === "signup" && role === "employer_admin" && (
              <Field
                label={t("company_label")}
                name="organization"
                autoComplete="organization"
                dir="auto"
                maxLength={100}
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                error={fieldErrors.company}
              />
            )}
            {mode === "signup" && role === "clinic_staff" && (
              <div className="space-y-1.5">
                <Label htmlFor="clinic-select">{t("choose_clinic")}</Label>
                <select
                  id="clinic-select"
                  name="clinic"
                  required
                  value={clinicId}
                  onChange={(e) => setClinicId(e.target.value)}
                  aria-invalid={fieldErrors.clinic ? true : undefined}
                  aria-describedby={fieldErrors.clinic ? "clinic-select-error" : undefined}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="" disabled>
                    {t("choose_clinic")}
                  </option>
                  {clinics.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.clinic && (
                  <p id="clinic-select-error" role="alert" className="text-sm font-medium text-destructive">
                    {fieldErrors.clinic}
                  </p>
                )}
              </div>
            )}
            <Button type="submit" disabled={busy} className="w-full">{busy ? t("loading") : mode === "login" ? t("login") : t("signup")}</Button>
          </form>
        </div>
      </div>
    </div>
  );
}
