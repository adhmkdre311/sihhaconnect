// BUG-10/18/19/20/21: client-side validators returning TRANSLATED messages.
// Each returns undefined when valid. `t` is the dictionary translate function.
export type Translator = (key: string) => string;

export const PASSWORD_MIN_LENGTH = 8;
export const NAME_MAX_LENGTH = 100;

// Qatar: 8 digits, optional +974 prefix (spaces/dashes tolerated, stripped first).
const PHONE_RE = /^(?:\+974)?\d{8}$/;
// Invite codes: uppercase alphanumerics + dashes, 4–20 chars (e.g. ACME-2026).
const INVITE_RE = /^[A-Z0-9][A-Z0-9-]{2,18}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRequired(value: string, t: Translator): string | undefined {
  return value.trim() ? undefined : t("validation_required");
}

export function validateEmail(email: string, t: Translator): string | undefined {
  if (!email.trim()) return t("validation_required");
  return EMAIL_RE.test(email.trim()) ? undefined : t("validation_email_invalid");
}

export function validatePassword(password: string, t: Translator): string | undefined {
  if (!password) return t("validation_required");
  return password.length >= PASSWORD_MIN_LENGTH ? undefined : t("validation_password_min");
}

export function validateConfirm(password: string, confirm: string, t: Translator): string | undefined {
  if (!confirm) return t("validation_required");
  return password === confirm ? undefined : t("validation_password_mismatch");
}

export function validateName(name: string, t: Translator): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return t("validation_required");
  return trimmed.length <= NAME_MAX_LENGTH ? undefined : t("validation_name_max");
}

export function validatePhone(phone: string, t: Translator): string | undefined {
  const cleaned = phone.replace(/[\s-]/g, "");
  if (!cleaned) return t("validation_required");
  return PHONE_RE.test(cleaned) ? undefined : t("validation_phone_invalid");
}

// Invite code is OPTIONAL: empty is valid; non-empty must match the format.
export function validateInviteFormat(code: string, t: Translator): string | undefined {
  const trimmed = code.trim();
  if (!trimmed) return undefined;
  return INVITE_RE.test(trimmed.toUpperCase()) ? undefined : t("validation_invite_format");
}

// 0 = empty, 1 = weak, 2 = medium, 3 = strong (length + variety heuristic).
export function passwordStrength(password: string): 0 | 1 | 2 | 3 {
  if (!password) return 0;
  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;
  if (score <= 1) return 1;
  if (score <= 3) return 2;
  return 3;
}