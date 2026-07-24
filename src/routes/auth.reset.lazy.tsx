// BUG-05 + BUG-12: recovery link handler, lazy split from the eager route.
import { createLazyFileRoute, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { validatePassword, validateConfirm } from "@/lib/validation";
import { mapAuthError } from "@/lib/authErrors";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

const RouteApi = getRouteApi("/auth/reset");

export const Route = createLazyFileRoute("/auth/reset")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t } = useLang();
  useDocumentTitle("reset_password");
  const navigate = useNavigate();
  const { token_hash, type } = RouteApi.useSearch();
  const [ready, setReady] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const ranVerify = useRef(false);

  // Resend reset email state
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [resendError, setResendError] = useState<string | undefined>();
  const [showResend, setShowResend] = useState(false);

  useEffect(() => {
    // Custom Resend flow: exchange the token_hash for a recovery session.
    if (token_hash && type === "recovery" && !ranVerify.current) {
      ranVerify.current = true;
      (async () => {
        const { error } = await supabase.auth.verifyOtp({ token_hash, type: "recovery" });
        if (error) {
          setLinkInvalid(true);
          return;
        }
        setReady(true);
      })();
      return;
    }
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, [token_hash, type]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const passwordError = validatePassword(password, t);
    const confirmError = validateConfirm(password, confirm, t);
    setErrors({ password: passwordError, confirm: confirmError });
    if (passwordError || confirmError) return;
    setLoading(true);
    setFormError(undefined);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setFormError(mapAuthError(error, t));
      return;
    }
    setDone(true);
  }

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    if (!resendEmail.trim()) {
      setResendError("Please enter your email address.");
      return;
    }
    setResendLoading(true);
    setResendError(undefined);
    setResendSent(false);
    const { error } = await supabase.auth.resetPasswordForEmail(resendEmail.trim(), {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    setResendLoading(false);
    if (error) {
      setResendError(mapAuthError(error, t));
      return;
    }
    setResendSent(true);
  }

  const ResendForm = (
    <form noValidate onSubmit={handleResend} className="space-y-3">
      <Field
        label="Email"
        type="email"
        name="resend-email"
        autoComplete="email"
        dir="ltr"
        value={resendEmail}
        onChange={(e) => setResendEmail(e.target.value)}
      />
      {resendError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {resendError}
        </p>
      )}
      {resendSent && (
        <p role="status" className="text-sm font-medium text-emerald-600">
          If an account exists for this email, a new reset link has been sent. Check your inbox.
        </p>
      )}
      <Button type="submit" disabled={resendLoading} className="w-full">
        {resendLoading ? t("loading") : "Send new reset link"}
      </Button>
    </form>
  );

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 p-6">
        <h1 className="text-xl font-semibold">{t("password_updated")}</h1>
        <Button onClick={() => navigate({ to: "/auth", search: { role: "worker", mode: "login" } })}>
          {t("back_to_login")}
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">{t("reset_title")}</h1>
      {linkInvalid ? (
        <div className="space-y-4">
          <p className="text-sm text-destructive">{t("verify_link_invalid")}</p>
          {ResendForm}
          <Button variant="ghost" onClick={() => navigate({ to: "/auth", search: { role: "worker", mode: "login" } })} className="w-full">
            {t("back_to_login")}
          </Button>
        </div>
      ) : !ready ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
          {!showResend ? (
            <Button variant="ghost" onClick={() => setShowResend(true)} className="w-full">
              Didn’t get the email? Resend reset link
            </Button>
          ) : (
            ResendForm
          )}
        </div>
      ) : (
        <form noValidate onSubmit={handleSubmit} className="space-y-4">
          <Field
            label={t("new_password_label")}
            type="password"
            name="new-password"
            autoComplete="new-password"
            dir="ltr"
            hint={t("password_hint")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
          <Field
            label={t("confirm_password_label")}
            type="password"
            name="confirm-password"
            autoComplete="new-password"
            dir="ltr"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={errors.confirm}
          />
          {formError && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {formError}
            </p>
          )}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? t("loading") : t("reset_password")}
          </Button>
          {!showResend ? (
            <Button type="button" variant="ghost" onClick={() => setShowResend(true)} className="w-full">
              Resend reset email
            </Button>
          ) : (
            ResendForm
          )}
        </form>
      )}
    </main>
  );
}
