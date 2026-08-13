# ARCHITECTURE.md

## Delivered layout (and how it maps to the spec's `sihha-platform/` tree)

The spec describes a multi-package repo (`apps/web`, `apps/mobile`, `supabase/` with
edge functions). This project is a single Lovable TanStack Start app, so the mapping is:

| Spec path | Here | Note |
| --- | --- | --- |
| `apps/web/` | repo root (`src/`) | Vite + React 19 + TS + Tailwind v4, TanStack Start/Router |
| `supabase/migrations` | `supabase/migrations/*.sql` | applied in order; the managed backend already has them |
| `supabase/seed.sql` | `scripts/seed-demo.ts` (`bun run seed:demo`) | demo accounts need the Auth admin API, not raw SQL |
| `supabase/functions/*` (3 edge functions) | `src/lib/*.functions.ts` server functions + `src/routes/lovable/email/auth/*` route handlers | app-internal logic is typed RPC on this stack; no Deno edge functions |
| `apps/mobile/` | not built | Expo worker app is a separate EAS pipeline; deferred |
| `docs/` | `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `docs/ENVIRONMENT.md` | this set |

## Layers

```text
browser (React 19)
  routes/            file-based routes, one per portal screen
  components/        shells: AppShell, ClinicShell, StaffFrame, AdminShell
  hooks/             useClinicQueue, useEmployerWorkers, useWorkerNotifications, useRealtimeTable
  lib/i18n.tsx       EN AR HI UR NE TL BN + RTL
        |
        | supabase-js (RLS as the signed-in user)  +  createServerFn RPC
        v
server (Worker runtime)
  lib/*.functions.ts  thin createServerFn wrappers (auth middleware where needed)
  lib/*.server.ts     privileged helpers, service-role client, AI gateway, Resend
        v
Postgres (Supabase)
  RLS everywhere + SECURITY DEFINER helpers (my_role, is_admin, ...)
  audit_logs triggers, slot-sync triggers, role-escalation guard trigger
  insurer_network_overview view = the ONLY insurer data surface
```

## Portals

`/app` worker · `/clinic` clinic staff · `/employer` employer admin ·
`/pharmacy` pharmacy staff · `/insurance` insurer · `/admin` platform admin.
Landing/role routing is centralised in `src/lib/portals.ts`.

## Enforced scope boundaries

- Assistant is never diagnostic — `src/lib/guardrail.ts` blocks 8 pattern classes and
  falls back to scripted replies in `src/lib/assistantFallback.ts`.
- Pharmacy is an availability directory only: `medication_availability` +
  `availability_lookup_events`; no prescriptions, no dispensing.
- Insurance sees aggregates only: raw `appointments`/`documents` return 0 rows for
  insurance staff (RLS), aggregation comes from `insurer_network_overview`.
- Roles live in `user_roles`, never on `profiles`; self-escalation is reverted by trigger.

## Data model (public schema)

`profiles`, `user_roles`, `role_requests`, `employers`, `employer_invites`, `clinics`,
`clinic_slots`, `clinic_invites`, `clinic_staff_permissions`, `appointments`, `documents`,
`chat_messages`, `chat_rate_limits`, `notifications`, `announcements`, `pharmacies`,
`medications`, `medication_availability`, `pharmacy_stock`, `pharmacy_lookups`,
`availability_lookup_events`, `insurers`, `insurer_employer_scope`, `claims`,
`platform_settings`, `audit_logs`, view `insurer_network_overview`.

## Testing

`bun run test` — unit (guardrail, utils, portals, fallback) + RLS/server-fn guard suites.
`tests/integration/rls-suite.sql` — the §9.2 15-check database suite, run through
`tests/integration/rls-suite.test.ts` when `INTEGRATION_DATABASE_URL` is set.