// BUG-06: post-signup / post-reset-request confirmation with 6-digit code
// entry + resend cooldown. Never surfaces raw Supabase errors.
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { resendSignupEmail, sendPasswordResetEmail } from "@/lib/email.functions";

const RESEND_COOLDOWN_SECONDS = 60;

interface CheckInboxProps {
  email: string;
  onBack: () => void;
  flow?: "signup" | "recovery";
}

export function CheckInbox({ email, onBack, flow = "signup" }: CheckInboxProps) {
  const { t } = useLang();
  const nav = useNavigate();
  const doResendSignup = useServerFn(resendSignupEmail);
  const doResendRecovery = useServerFn(sendPasswordResetEmail);
  const doResend = flow === "recovery" ? doResendRecovery : doResendSignup;
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | undefined>();
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);
  const [resendError, setResendError] = useState<string | undefined>();

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  async function handleResend() {
    if (busy || cooldown > 0) return;
    setBusy(true);
    setResent(false);
    setResendError(undefined);
    try {
      await doResend({ data: { email } });
    } catch {
      setResendError(t("error_network"));
      setBusy(false);
      return;
    }
    setBusy(false);
    setResent(true);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const token = code.replace(/\D/g, "");
    if (token.length !== 6) {
      setVerifyError("Enter the 6-digit code from your email.");
      return;
    }
    setVerifying(true);
    setVerifyError(undefined);
    const { error } = flow === "recovery"
      ? await supabase.auth.verifyOtp({ email, token, type: "recovery" })
      : await supabase.auth.verifyOtp({ email, token, type: "signup" });
    setVerifying(false);
    if (error) {
      setVerifyError("That code is invalid or has expired. Try again or resend.");
      return;
    }
    // Session is now established. Hand off to the flow-specific handler
    // for post-verify bootstrap or password entry.
    nav({ to: flow === "recovery" ? "/auth/reset" : "/auth/verify" });
  }

  return (
    <div className="space-y-4" role="status">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">{t("check_inbox_title")}</h2>
        <p className="text-sm text-muted-foreground">
          We emailed a 6-digit code to
        </p>
        <p className="text-sm font-medium">
          <span dir="ltr" className="[unicode-bidi:isolate]">{email}</span>
        </p>
      </div>
      <form noValidate onSubmit={handleVerify} className="space-y-3">
        <Field
          label="Verification code"
          name="otp"
          type="text"
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]*"
          dir="ltr"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          error={verifyError}
        />
        <Button type="submit" disabled={verifying || code.replace(/\D/g, "").length !== 6} className="w-full">
          {verifying ? t("loading") : "Verify code"}
        </Button>
      </form>
      {resendError && (
        <p role="alert" className="text-sm font-medium text-destructive text-center">
          {resendError}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={handleResend}
        disabled={busy || cooldown > 0}
        className="w-full"
      >
        {busy
          ? t("resending")
          : cooldown > 0
          ? `${t("resend_confirmation")} (${cooldown})`
          : resent
          ? t("resent")
          : t("resend_confirmation")}
      </Button>
      <Button type="button" variant="ghost" onClick={onBack} className="w-full">
        {t("back_to_login")}
      </Button>
    </div>
  );
}