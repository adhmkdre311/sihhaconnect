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
4. **Verify** — run the §9.4 acceptance suite:
   ```bash
   bun run acceptance
   ```
   This runs three stages: §9.1 unit/guard tests (vitest), the §9.2 15-check database
   suite, and the §9.4 per-module definition-of-done checks. To include the database
   suite, supply a local Supabase connection via one of:
   - `INTEGRATION_DATABASE_URL` env var, e.g. `postgresql://postgres:postgres@localhost:54322/postgres`
   - `--db <url>` flag, e.g. `bun run acceptance -- --db postgres://...`
   - Standard `PGHOST` / `PGPORT` / `PGDATABASE` / `PGUSER` / `PGPASSWORD` env vars
   Use `--skip-db` to omit the database suite (e.g. in CI without a local Supabase). Use
   `--json` for machine-readable CI output.
   Then walk §9.4 per module using the six demo accounts in `docs/ENVIRONMENT.md`.

## Environments

| | URL |
| --- | --- |
| Preview (latest build) | `project--<project-id>-dev.lovable.app` |
| Production (published) | `sihhaconnect.lovable.app` |

Publish from Lovable; the build is `vite build` targeting the Worker runtime. Nothing in
server code may rely on `child_process`, `sharp`, native addons, or `os.cpus()`.

## Release checklist

- `bun run acceptance` green (or `bun run test` for the fast guard); `bun run lint` clean.
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