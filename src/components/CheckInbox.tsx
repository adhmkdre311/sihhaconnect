// Post-signup / post-reset confirmation screen. Uses Supabase's managed
// email link flow (Lovable branded templates). Users click the link in
// their inbox; the resend button re-triggers Supabase's send.
import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const RESEND_COOLDOWN_SECONDS = 60;

interface CheckInboxProps {
  email: string;
  onBack: () => void;
  flow?: "signup" | "recovery";
}

export function CheckInbox({ email, onBack, flow = "signup" }: CheckInboxProps) {
  const { t } = useLang();
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
      if (flow === "recovery") {
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset`,
        });
      } else {
        await supabase.auth.resend({
          type: "signup",
          email,
          options: { emailRedirectTo: `${window.location.origin}/auth/verify` },
        });
      }
    } catch {
      setResendError(t("error_network"));
      setBusy(false);
      return;
    }
    setBusy(false);
    setResent(true);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  return (
    <div className="space-y-4" role="status">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">{t("check_inbox_title")}</h2>
        <p className="text-sm text-muted-foreground">
          {flow === "recovery"
            ? "We just emailed a password reset link to"
            : "We just emailed a confirmation link to"}
        </p>
        <p className="text-sm font-medium">
          <span dir="ltr" className="[unicode-bidi:isolate]">{email}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Click the link in that email to continue. It may take a minute to arrive — check your spam folder if you don't see it.
        </p>
      </div>
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