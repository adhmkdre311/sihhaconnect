# DEPLOYMENT.md

## Ingestion order (spec §11, adapted to this stack)

1. **App root** — the Lovable project root *is* the web app; there is no `apps/web`
   subfolder to select. The two client env vars (`VITE_SUPABASE_URL`,
   `VITE_SUPABASE_PUBLISHABLE_KEY`) plus `VITE_SUPABASE_PROJECT_ID` are generated and kept
   in sync automatically — never edit `.env` by hand.
2. **Database** — apply `supabase/migrations/*.sql` in filename order (the managed backend
   already has them). Then seed demo data with `bun run seed:demo`
   (`-- --reset` recreates the six accounts clean). `seed.sql` cannot create auth users,
   which is why seeding is a script.
3. **Server logic** — nothing to deploy separately. Server functions and route handlers
   ship with the app build; no Deno edge functions and no `ANTHROPIC_API_KEY`. AI runs
   through the Lovable AI Gateway (`LOVABLE_API_KEY`, injected). Email needs
   `RESEND_API_KEY` and `RESEND_FROM` as backend secrets.
4. **Verify** — run the acceptance pass, starting with the database suite:
   ```bash
   bun run test                                   # unit + RLS/server-fn guards
   INTEGRATION_DATABASE_URL=... bun run test      # adds the 15-check §9.2 suite
   ```
   Then walk §9.4 per module using the six demo accounts in `docs/ENVIRONMENT.md`.

## Environments

| | URL |
| --- | --- |
| Preview (latest build) | `project--<project-id>-dev.lovable.app` |
| Production (published) | `sihhaconnect.lovable.app` |

Publish from Lovable; the build is `vite build` targeting the Worker runtime. Nothing in
server code may rely on `child_process`, `sharp`, native addons, or `os.cpus()`.

## Release checklist

- `bun run test` green; `bun run lint` clean.
- `bun run types:check` shows no drift after any migration.
- Database linter reviewed: RLS enabled and GRANTs present on every new public table.
- Auth: Google provider configured; no anonymous sign-ups; email confirmation on.
- Demo accounts rotated or deleted before a public launch.
- Storage: `documents` bucket private, worker-own-folder policies intact.
- 12-month document purge cron still scheduled.

## Legal gates before production launch

These are process gates, not code changes — the technical boundaries they require are
already enforced (see ARCHITECTURE.md → *Enforced scope boundaries*):

- Pharmacy Partnership Agreement signed.
- Insurance Data Sharing Agreement signed.
- PDPPL consent language at worker enrolment reviewed by counsel
  (blocking consent modal, `profiles.consent_accepted_at`).
- DPIA commissioned.

## Deferred

`apps/mobile` (Expo worker app, separate EAS pipeline) and M8 org-branch hierarchy are
not part of this delivery.