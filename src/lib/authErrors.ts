// BUG-10: map raw Supabase GoTrue errors to translated UI strings.
// Never render err.message from Supabase directly in the UI.

export type Translator = (key: string) => string;

interface SupabaseAuthErrorLike {
  code?: string;
  message?: string;
  status?: number;
}

export function mapAuthError(err: unknown, t: Translator): string {
  const e = (err ?? {}) as SupabaseAuthErrorLike;
  const code = (e.code ?? "").toLowerCase();
  const msg = (e.message ?? "").toLowerCase();

  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) {
    return t("error_invalid_credentials");
  }
  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return t("error_email_not_confirmed");
  }
  // Supabase rejects breached/weak passwords server-side with 422 weak_password
  // (reasons may include "pwned") — keep this working and surface it translated.
  if (code === "weak_password" || msg.includes("weak password") || msg.includes("password is known")) {
    return t("error_weak_password");
  }
  if (msg.includes("failed to fetch") || msg.includes("network") || code === "network_error") {
    return t("error_network");
  }
  return t("error_signup_generic");
}

// True when the login failure is specifically an unconfirmed email —
// used to show the inline resend path instead of a bare error (BUG-06).
export function isEmailNotConfirmed(err: unknown): boolean {
  const e = (err ?? {}) as SupabaseAuthErrorLike;
  return (
    (e.code ?? "").toLowerCase() === "email_not_confirmed" ||
    (e.message ?? "").toLowerCase().includes("email not confirmed")
  );
}