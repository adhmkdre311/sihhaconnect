// BUG-06: post-signup / post-reset-request confirmation state with
// resend + cooldown. Never surfaces raw Supabase errors.
import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const RESEND_COOLDOWN_SECONDS = 60;

interface CheckInboxProps {
  email: string;
  onBack: () => void;
}

export function CheckInbox({ email, onBack }: CheckInboxProps) {
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
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) throw error;
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
    <div className="space-y-4 text-center" role="status">
      <h2 className="text-xl font-semibold">{t("check_inbox_title")}</h2>
      <p className="text-sm text-muted-foreground">{t("check_inbox_body")}</p>
      <p className="text-sm font-medium">
        <span dir="ltr" className="[unicode-bidi:isolate]">
          {email}
        </span>
      </p>
      {resendError && (
        <p role="alert" className="text-sm font-medium text-destructive">
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