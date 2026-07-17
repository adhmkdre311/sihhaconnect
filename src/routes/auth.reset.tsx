// BUG-05: handles the Supabase recovery link (/auth/reset#access_token=…).
// Supabase delivers the recovery session via URL hash; onAuthStateChange
// fires PASSWORD_RECOVERY, then updateUser sets the new password.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { validatePassword, validateConfirm } from "@/lib/validation";
import { mapAuthError } from "@/lib/authErrors";

export const Route = createFileRoute("/auth/reset")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

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
      {!ready ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
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
        </form>
      )}
    </main>
  );
}