// Custom Resend flow: verify a signup (or magiclink resend) via token_hash,
// then run the correct bootstrap using metadata packed at sign-up time.
import { createLazyFileRoute, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { bootstrapWorker, bootstrapEmployer, bootstrapClinicStaff } from "@/lib/roles.functions";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

const RouteApi = getRouteApi("/auth/verify");

export const Route = createLazyFileRoute("/auth/verify")({
  component: VerifyPage,
});

type Status = "verifying" | "success" | "error";

function VerifyPage() {
  const { t } = useLang();
  useDocumentTitle("verifying_email");
  const { token_hash, type } = RouteApi.useSearch();
  const nav = useNavigate();
  const { refreshRoles } = useAuth();
  const runBootstrapWorker = useServerFn(bootstrapWorker);
  const runBootstrapEmployer = useServerFn(bootstrapEmployer);
  const runBootstrapClinic = useServerFn(bootstrapClinicStaff);
  const [status, setStatus] = useState<Status>("verifying");
  const [error, setError] = useState<string | undefined>();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      // Two entry paths:
      //  1) Legacy magic-link URL with token_hash → exchange for a session.
      //  2) 6-digit OTP flow → CheckInbox already established the session and
      //     routed here with no params.
      let userMeta: Record<string, unknown> | undefined;
      if (token_hash && type) {
        const otpType = type === "magiclink" ? "magiclink" : "signup";
        const { data, error: verifyErr } = await supabase.auth.verifyOtp({
          token_hash,
          type: otpType,
        });
        if (verifyErr || !data.session || !data.user) {
          setStatus("error");
          setError(t("verify_link_invalid"));
          return;
        }
        userMeta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
      } else {
        const { data: sess } = await supabase.auth.getSession();
        if (!sess.session?.user) {
          setStatus("error");
          setError(t("verify_missing_token"));
          return;
        }
        userMeta = (sess.session.user.user_metadata ?? {}) as Record<string, unknown>;
      }
      const meta = userMeta;
      const role = (meta.pending_role as string | undefined) ?? "worker";
      const fullName = (meta.full_name as string | undefined) ?? "";
      const lang = (meta.preferred_language as "en"|"ar"|"hi"|"ur"|"ne"|"tl"|"bn" | undefined) ?? "en";
      const phone = (meta.phone_number as string | undefined) ?? "";
      const invite = (meta.pending_invite_code as string | undefined) ?? undefined;
      const company = (meta.pending_company_name as string | undefined) ?? "";
      const clinicId = (meta.pending_clinic_id as string | undefined) ?? "";

      try {
        if (role === "worker") {
          await runBootstrapWorker({ data: {
            fullName, phoneNumber: phone || "0000", preferredLanguage: lang,
            inviteCode: invite,
          }});
          if (invite) {
            await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ error: unknown }>)(
              "consume_invite", { _code: invite },
            ).catch(() => undefined);
          }
        } else if (role === "employer_admin") {
          await runBootstrapEmployer({ data: {
            companyName: company || fullName, fullName,
          }});
          await supabase.rpc("request_privileged_role", {
            _role: "employer_admin",
            _clinic_id: null as unknown as string,
            _company_name: company,
          });
        } else if (role === "clinic_staff" && clinicId) {
          await runBootstrapClinic({ data: { clinicId, fullName }});
          await supabase.rpc("request_privileged_role", {
            _role: "clinic_staff",
            _clinic_id: clinicId,
            _company_name: null as unknown as string,
          });
        }
      } catch (err) {
        console.warn("post-verify bootstrap failed", err);
      }

      await refreshRoles();
      setStatus("success");
      const home = role === "employer_admin" ? "/employer" : role === "clinic_staff" ? "/clinic" : "/app";
      setTimeout(() => nav({ to: home }), 800);
    })();
  }, [token_hash, type, nav, refreshRoles, runBootstrapWorker, runBootstrapEmployer, runBootstrapClinic, t]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      {status === "verifying" && (
        <>
          <h1 className="text-xl font-semibold">{t("verifying_email")}</h1>
          <p className="text-sm text-muted-foreground">{t("please_wait")}</p>
        </>
      )}
      {status === "success" && (
        <>
          <h1 className="text-xl font-semibold text-primary">{t("email_verified")}</h1>
          <p className="text-sm text-muted-foreground">{t("redirecting")}</p>
        </>
      )}
      {status === "error" && (
        <>
          <h1 className="text-xl font-semibold text-destructive">{t("verify_link_invalid")}</h1>
          {error && <p className="text-sm text-muted-foreground">{error}</p>}
          <Button onClick={() => nav({ to: "/auth", search: { role: "worker", mode: "login" } })}>
            {t("back_to_login")}
          </Button>
        </>
      )}
    </main>
  );
}
