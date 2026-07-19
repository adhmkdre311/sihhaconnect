
# Stabilize Auth + Core Flows

The auth stack is currently a hybrid: custom Resend server functions issue Supabase-generated OTPs, the CheckInbox screen enters the code, then `/auth/verify` re-reads user metadata and runs role bootstrap. Each hop is a failure point (OTP length drift, second-click "consumed" errors, verify page hanging on missing metadata, Resend domain issues). Google sign-in leans on the same fragile handoff. This plan replaces the custom path with Lovable's managed auth email path, so signup, verification, password reset, and Google all go through one well-tested code path, then verifies the three role home screens still load.

## Step 1 — Switch signup + password reset to Supabase native

- In `src/routes/auth.index.lazy.tsx`:
  - Replace `startEmailSignup` server-fn call with `supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + '/auth/verify', data: { full_name, preferred_language, pending_role, pending_invite_code, pending_company_name, pending_clinic_id, phone_number } } })`.
  - Replace `sendPasswordResetEmail` server-fn call with `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/auth/reset' })`.
  - Keep the invite `validate_invite` RPC pre-check as-is.
- Update `CheckInbox.tsx` to show a "click the link we just emailed you" message instead of an OTP field. Keep the resend button, powered by `supabase.auth.resend({ type: 'signup' | 'recovery', email })`.
- Delete the custom OTP code paths from `src/lib/email.functions.ts` (`startEmailSignup`, `resendSignupEmail`, `sendPasswordResetEmail`) and `src/lib/email.server.ts` (`sendAuthCodeEmail`). Keep the generic `sendEmail` helper for future app emails.

## Step 2 — Scaffold Lovable managed auth email templates

- Call `email_domain--scaffold_auth_email_templates` so signup, magic-link, recovery, invite, email-change, and reauthentication emails all render with Sihha branding via Lovable's managed sender (no Resend dependency for auth). This uses the existing `notify.sihhaconnect.app` delegation already verified.
- Apply the Sihha color/typography tokens from `src/styles.css` inside the generated templates.

## Step 3 — Fix `/auth/verify` and `/auth/reset` for the link flow

- Rewrite `src/routes/auth.verify.lazy.tsx` to:
  - On mount, wait for `supabase.auth.onAuthStateChange` `SIGNED_IN` (the confirmation link exchanges the token automatically) OR read `getSession()`.
  - Read `user_metadata` and run the existing `bootstrapWorker` / `bootstrapEmployer` / `bootstrapClinicStaff` server fns.
  - Redirect to the role home; on error, show a retry back to `/auth`.
- Ensure `src/routes/auth.reset.lazy.tsx` handles the `type=recovery` session and `supabase.auth.updateUser({ password })` correctly.

## Step 4 — Verify Google sign-in end-to-end

- Confirm `supabase--configure_social_auth` has `google` enabled (re-run if needed).
- Keep the button in `auth.index.lazy.tsx` using `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`.
- After the popup/redirect resolves, run the same bootstrap logic used by `/auth/verify` (extract role from `user_metadata` if present; if a Google user has no `pending_role`, default to `worker` and land on `/app`).
- Test in the published preview: new Google user → `/app`; returning Google user → their role home.

## Step 5 — Post-login smoke test

- Load `/app`, `/employer`, `/clinic` after login and confirm each renders (fixing any obvious crash caught during the pass — nothing beyond what login exposes).
- Verify the `user_roles` query returning `[]` for a fresh Google user does not deadlock the shell; if it does, add a "role pending" fallback screen (already present in signup flow — reuse it).

## Step 6 — Report

Deliver a short written report covering:
- What was broken and what changed.
- Which auth path each flow now uses (managed link email vs Google OAuth).
- **Features still to consider** before this is a production-grade app: profile completion screen for Google users, role approval UI for employer/clinic admins, phone/OTP fallback for workers without email, session refresh handling on the PWA, monitored error reporting, and end-to-end tests for each role. This report is chat-only, no code.

## Technical notes

- Files touched: `src/routes/auth.index.lazy.tsx`, `src/routes/auth.verify.lazy.tsx`, `src/routes/auth.reset.lazy.tsx`, `src/components/CheckInbox.tsx`, `src/lib/email.functions.ts`, `src/lib/email.server.ts`, plus new template files scaffolded under `supabase/functions/auth-email-hook/` and `_shared/email-templates/`.
- No schema changes. `role_requests`, `has_role`, `bootstrapWorker/Employer/ClinicStaff` all stay as-is.
- `RESEND_FROM` and the Resend connector remain configured for future app emails but are no longer on the auth critical path.
- Stops here: no dashboard feature work, no new tables, no marketing polish — that goes in the report as follow-ups.
