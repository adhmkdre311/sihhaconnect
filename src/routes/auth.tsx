import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { isEmailNotConfirmed } from "@/lib/authErrors";
import { CheckInbox } from "@/components/CheckInbox";
import {
  validateEmail,
  validatePassword,
  validateConfirm,
  validateName,
  validatePhone,
  validateRequired,
  validateInviteFormat,
  passwordStrength,
} from "@/lib/validation";
import { PasswordToggle } from "@/components/PasswordToggle";

// BUG-08: safe search-param parsing — never throw, always fall back.
const ROLES = ["worker", "employer_admin", "clinic_staff"] as const;
export type Role = (typeof ROLES)[number];
export type AuthMode = "login" | "signup";

export function parseRole(value: unknown): Role {
  return (ROLES as readonly string[]).includes(value as string) ? (value as Role) : "worker";
}

export function parseMode(value: unknown): AuthMode {
  // default is 'login' so gate redirects land on Log in (BUG-27);
  // the landing role cards pass mode=signup explicitly.
  return value === "signup" ? "signup" : "login";
}

export function parseNext(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  // internal absolute paths only — blocks open redirects (//evil.com, backslash tricks)
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return undefined;
  return value;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    role: parseRole(s.role),
    mode: parseMode(s.mode),
    next: parseNext(s.next),
  }),
  component: AuthPage,
});

function AuthPage() {
  const { role, mode: initialMode } = Route.useSearch();
  const { t, lang } = useLang();
  const { refreshRoles } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [clinicId, setClinicId] = useState("");
  const [clinics, setClinics] = useState<{id:string;name:string}[]>([]);
  const [busy, setBusy] = useState(false);
  // BUG-06: view state for post-signup confirmation & inline unconfirmed-login
  const [view, setView] = useState<"form" | "check-inbox" | "role-pending" | "forgot">("form");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [formError, setFormError] = useState<string | undefined>();
  const [showResendInline, setShowResendInline] = useState(false);

  const runBootstrapWorker = useServerFn(bootstrapWorker);
  const runBootstrapEmployer = useServerFn(bootstrapEmployer);
  const runBootstrapClinic = useServerFn(bootstrapClinicStaff);

  // BUG-03/10: field-level errors keyed by field name; wired to Field's aria-describedby.
  // Full validation is added in Task 7; this state is used starting Task 5 (forgot flow).
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<"name" | "email" | "password" | "phone" | "company" | "invite" | "clinic" | "confirm", string>>>({});

  useEffect(() => {
    if (role === "clinic_staff") {
      void supabase.from("clinics").select("id,name").then(({ data }) => setClinics(data ?? []));
    }
  }, [role]);

  const targetFor = () =>
    role === "worker" ? "/app" : role === "employer_admin" ? "/employer" : "/clinic";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(undefined);
    setShowResendInline(false);
    // BUG-10/18/19/20: run translated client-side validation before any network call.
    if (mode === "login") {
      const next = {
        email: validateEmail(email, t),
        // Do not enforce min-length on login (legacy 6-char accounts).
        password: validateRequired(password, t),
      };
      setFieldErrors(next);
      if (Object.values(next).some(Boolean)) {
        requestAnimationFrame(() =>
          document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
        );
        return;
      }
    } else {
      const next: Record<string, string | undefined> = {
        name: validateName(fullName, t),
        email: validateEmail(email, t),
        password: validatePassword(password, t),
        confirm: validateConfirm(password, confirmPassword, t),
        phone: role === "worker" ? validatePhone(phone, t) : undefined,
        company: role === "employer_admin" ? validateRequired(companyName, t) : undefined,
        clinic: role === "clinic_staff" && !clinicId ? t("validation_required") : undefined,
        invite: role === "worker" ? validateInviteFormat(inviteCode, t) : undefined,
      };
      setFieldErrors(next);
      if (Object.values(next).some(Boolean)) {
        requestAnimationFrame(() =>
          document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
        );
        return;
      }
    }
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          // BUG-06/25: persistent inline error; special-case unconfirmed email.
          if (isEmailNotConfirmed(error)) {
            setFormError(t("error_email_not_confirmed"));
            setShowResendInline(true);
          } else {
            setFormError(mapAuthError(error, t));
          }
          return;
        }
        await refreshRoles();
        toast.success("Welcome back");
        nav({ to: targetFor() });
        return;
      }
      // signup
      // BUG-19: anon-safe invite validation BEFORE account creation.
      const trimmedCode = role === "worker" ? inviteCode.trim() : "";
      if (trimmedCode) {
        const { error: inviteError } = await supabase.rpc("validate_invite", {
          _code: trimmedCode,
        });
        if (inviteError) {
          setFieldErrors((prev) => ({ ...prev, invite: t("error_invalid_invite") }));
          requestAnimationFrame(() =>
            document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
          );
          return;
        }
      }
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName, preferred_language: lang } },
      });
      if (error) throw error;
      // BUG-04: privileged roles (clinic_staff, employer_admin) are REQUESTED,
      // never self-granted. Worker signup keeps its immediate grant + invite flow.
      if (role !== "worker") {
        if (role === "clinic_staff" && !clinicId) {
          setFormError(t("validation_required"));
          return;
        }
        const { error: rrErr } = await supabase.rpc("request_privileged_role", {
          _role: role,
          _clinic_id: (role === "clinic_staff" ? clinicId : null) as unknown as string,
          _company_name: (role === "employer_admin" ? companyName : null) as unknown as string,
        });
        if (rrErr) {
          console.warn("request_privileged_role failed", rrErr);
          setFormError(t("error_signup_generic"));
          return;
        }
        setView("role-pending");
        return;
      }
      // Worker path.
      // BUG-06: if a session exists (confirmation off), bootstrap and enter app;
      // otherwise show the persistent Check-Inbox screen — never auto-login.
      if (data.session) {
        await runBootstrapWorker({ data: { fullName, phoneNumber: phone, preferredLanguage: lang, inviteCode: inviteCode || undefined } });
        await refreshRoles();
        toast.success("Account ready");
        nav({ to: targetFor() });
        return;
      }
      // BUG-19: authenticated invite consumption — links employer server-side.
      // Failure must NOT block onboarding.
      if (trimmedCode && data.user) {
        const { error: consumeError } = await supabase.rpc("consume_invite", {
          _code: trimmedCode,
        });
        if (consumeError) {
          console.warn("consume_invite failed", consumeError);
          toast.warning(t("error_invalid_invite"));
        }
      }
      setSubmittedEmail(email);
      setView("check-inbox");
    } catch (err: unknown) {
      // BUG-10/25: persistent inline error; translated, never raw.
      setFormError(mapAuthError(err, t));
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
          {view === "check-inbox" ? (
            <CheckInbox
              email={submittedEmail}
              onBack={() => {
                setView("form");
                setMode("login");
                setFormError(undefined);
                setShowResendInline(false);
              }}
            />
          ) : view === "role-pending" ? (
            <div className="space-y-4 text-center" role="status">
              <h2 className="text-xl font-semibold">{t("role_pending_title")}</h2>
              <p className="text-sm text-muted-foreground">{t("role_pending_body")}</p>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setView("form");
                  setMode("login");
                  setFormError(undefined);
                }}
              >
                {t("back_to_login")}
              </Button>
            </div>
          ) : view === "forgot" ? (
            <form
              noValidate
              onSubmit={async (e) => {
                e.preventDefault();
                const emailError = validateEmail(email, t);
                setFieldErrors((prev) => ({ ...prev, email: emailError }));
                if (emailError) return;
                setBusy(true);
                await supabase.auth.resetPasswordForEmail(email, {
                  redirectTo: `${window.location.origin}/auth/reset`,
                });
                setBusy(false);
                // Enumeration-safe: show the inbox screen either way.
                setSubmittedEmail(email);
                setView("check-inbox");
              }}
              className="space-y-4"
            >
              <h2 className="text-xl font-semibold">{t("reset_title")}</h2>
              <p className="text-sm text-muted-foreground">{t("reset_body")}</p>
              <Field
                label={t("email_label")}
                type="email"
                name="email"
                autoComplete="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={fieldErrors.email}
              />
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? t("loading") : t("send_reset_link")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setView("form");
                  setMode("login");
                  setFieldErrors({});
                }}
              >
                {t("back_to_login")}
              </Button>
            </form>
          ) : (
          <>
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
              type={showPassword ? "text" : "password"}
              name={mode === "signup" ? "new-password" : "current-password"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              dir="ltr"
              minLength={8}
              required
              hint={mode === "signup" ? t("password_hint") : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
              trailing={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
            />
            {mode === "signup" && password.length > 0 && (
              <p
                aria-live="polite"
                className={
                  passwordStrength(password) === 3
                    ? "text-xs font-medium text-primary"
                    : passwordStrength(password) === 2
                    ? "text-xs font-medium text-muted-foreground"
                    : "text-xs font-medium text-destructive"
                }
              >
                {passwordStrength(password) === 3
                  ? t("password_strength_strong")
                  : passwordStrength(password) === 2
                  ? t("password_strength_medium")
                  : t("password_strength_weak")}
              </p>
            )}
            {mode === "signup" && (
              <Field
                label={t("confirm_password_label")}
                type={showPassword ? "text" : "password"}
                name="confirm-password"
                autoComplete="new-password"
                dir="ltr"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={fieldErrors.confirm}
              />
            )}
            {mode === "login" && (
              <button
                type="button"
                className="text-sm font-medium text-primary underline underline-offset-4"
                onClick={() => {
                  setView("forgot");
                  setFormError(undefined);
                  setShowResendInline(false);
                }}
              >
                {t("forgot_password")}
              </button>
            )}
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
            {formError && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {formError}
              </p>
            )}
            {showResendInline && (
              <button
                type="button"
                className="text-sm font-medium text-primary underline underline-offset-4"
                onClick={async () => {
                  await supabase.auth.resend({ type: "signup", email });
                  setSubmittedEmail(email);
                  setView("check-inbox");
                }}
              >
                {t("resend_confirmation")}
              </button>
            )}
          </form>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
