# 10. Environment & Configuration

## Web client (this app)

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `.env` (managed) | backend connection for the browser (safe: RLS-protected) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env` (managed) | publishable/anon key — the current equivalent of `VITE_SUPABASE_ANON_KEY` |
| `VITE_SUPABASE_PROJECT_ID` | `.env` (managed) | project reference used by tooling |

These three are generated and kept in sync automatically — never edit them by hand.

## Native mobile (Expo, when the mobile app is added)

| Variable | Where | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | `apps/mobile/.env` | same backend URL, exposed to Expo |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `apps/mobile/.env` | same publishable key, exposed to Expo |

Copy the values from the web `.env`; both clients talk to the same project and are protected by the same RLS policies.

## Server-side secrets

| Variable | Where | Purpose |
| --- | --- | --- |
| `LOVABLE_API_KEY` | backend secret (auto) | AI access through the Lovable AI Gateway. Replaces `ANTHROPIC_API_KEY`: the gateway brokers the model, so no vendor key is stored. Model is pinned in `src/lib/ai.functions.ts` (`google/gemini-2.5-flash`); assistant/summary calls fall back to scripted, non-diagnostic replies (`src/lib/assistantFallback.ts`) when the gateway is unavailable, so the app stays usable without any AI key. |
| `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` | backend secret (auto) | server-side reads that must respect RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | backend secret (auto) | privileged fan-out only — broadcast notifications, admin console, invite acceptance. Never imported into client code (`client.server.ts` is server-only). |
| `RESEND_API_KEY` / `RESEND_FROM` | backend secret | transactional + auth email delivery |

`ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` are **not** required on this stack. If a Claude
model is ever preferred, add the key as a backend secret and switch the `model` argument
in `src/lib/ai.functions.ts`; the guardrail and fallback layers are model-agnostic.

## Seeded demo accounts

Password for all six: `SihhaDemo#2026`

| Email | Role | Lands on | Organisation |
| --- | --- | --- | --- |
| `admin@sihha.qa` | `platform_admin` | `/admin` | — |
| `suman@worker.sihha.qa` | `worker` | `/app` | Al Wathba Trading & Contracting |
| `fatima@alwathba.qa` | `employer_admin` | `/employer` | Al Wathba Trading & Contracting |
| `desk@alrayyanclinic.qa` | `clinic_staff` | `/clinic` | Al Rayyan Clinic (all desk permissions) |
| `anjali@alnasrpharmacy.qa` | `pharmacy_staff` | `/pharmacy` | Al Nasr Pharmacy |
| `khalid@qlm.qa` | `insurance_staff` | `/insurance` | QLM Life & Medical Insurance (scoped to Al Wathba) |

All demo users are email-confirmed, approved and active. Demo organisations use fixed ids
(`d0000000-0000-4000-8000-00000000000{1..4}`) so re-seeding is idempotent.

> Demo accounts are for pilot/QA environments. Rotate or delete them before a public launch.