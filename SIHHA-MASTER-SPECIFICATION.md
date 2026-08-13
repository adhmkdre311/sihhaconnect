# Sihha — Master Specification (delivered state)

Single-file specification of what is built, section-for-section against the source spec.
Deep detail lives in `docs/`: [ARCHITECTURE](docs/ARCHITECTURE.md) ·
[API](docs/API.md) · [DEPLOYMENT](docs/DEPLOYMENT.md) · [ENVIRONMENT](docs/ENVIRONMENT.md).

## 1. Product overview

Sihha is a five-sided occupational-health platform for migrant workers in Qatar: a worker
app plus clinic, employer, pharmacy, insurance and platform-admin portals, with a
multilingual non-diagnostic AI assistant.

### 1.2 Scope boundaries (Legal v2) — enforced in code
- Assistant is **never diagnostic**: 8 blocked pattern classes in `src/lib/guardrail.ts`,
  scripted fallbacks in `src/lib/assistantFallback.ts`.
- Pharmacy is an **availability directory** only — no prescribing, no dispensing.
- Insurance sees **aggregates only**; raw appointments/documents are 0 rows under RLS.

### 1.3 Roles and portals
`worker → /app` · `clinic_staff → /clinic` · `employer_admin → /employer` ·
`pharmacy_staff → /pharmacy` · `insurance_staff → /insurance` ·
`platform_admin`/`super_admin` → `/admin`. Routing source of truth: `src/lib/portals.ts`.

### 1.4 Languages
EN, AR, HI, UR, NE, TL, BN with full RTL for Arabic (`src/lib/i18n.tsx`, logical CSS
properties, mirrored icons, LTR-forced numerals).

## 2. Technical architecture
React 19 + TypeScript + Tailwind v4 on TanStack Start (Vite), Supabase Postgres with RLS,
typed server functions for all app-internal server logic, Lovable AI Gateway for AI,
Resend for email. See ARCHITECTURE.md.

## 3. Data models
27 public tables + `insurer_network_overview`; roles isolated in `user_roles`; audit
triggers with old→new diffs; slot-sync triggers; `platform_settings` for tunables.
Full list in ARCHITECTURE.md.

## 4. Modules
- **B Worker app** — Home, Book, Assistant, Documents, pharmacy search, emergency,
  notifications, profile; document upload with camera/file picker; PWA installable.
- **C Clinic portal** — live queue, slot management, patient records, walk-in booking,
  staff invites and per-desk permissions, interpreter flags.
- **D Employer portal** — roster, invite links, appointments, compliance overview with
  configurable checkup interval, broadcasts, billing view, inbox.
- **E Pharmacy hub** — availability listing management, visibility dashboard, settings.
- **F Insurance portal** — network aggregates, compliance progress, claims history with
  filters and CSV export.
- **G Platform admin** — dashboard, users & role matrix, organisations, announcements,
  data records, analytics, audit logs, settings, approvals.

## 5. Design system
Brand-locked: Pearl Sand / Doha Teal / Dune Gold semantic tokens in `src/styles.css`,
Space Grotesk + Inter + Noto Sans, `SihhaLogo` from the official SVG lockups.

## 6. Bug list
BUG-1 audit diff-only rows · BUG-3 cross-table RLS in security-definer helpers ·
BUG-4a insurer reads go through the aggregate view · BUG-4b slot availability by trigger ·
BUG-12 lazy auth route. Regression coverage in `tests/bug-regressions.test.ts`.

## 7. Enhancements
E1–E12 delivered: shared data hooks, realtime table hook, localized formatting, generic
DataTable, voice input, immediate note translation, type-drift check in CI.

## 8. Missing components
M1 employer invites · M2 staff notifications centre · M3 storage uploads ·
M4 password reset / email change · M5 walk-in booking · M6 compliance rules engine ·
M7 audited read-only "view as" — all delivered. **M8** org branch hierarchy deferred.

## 9. Testing
§9.1 unit suites (guardrail, utils, portals, fallback), §9.2 the 15-check database suite
(`tests/integration/rls-suite.sql`), §9.4 acceptance walkthrough via the six demo accounts.

## 10. Environment & configuration
See ENVIRONMENT.md. Client vars are managed; server secrets are `LOVABLE_API_KEY`,
`RESEND_API_KEY`, `RESEND_FROM`. No Anthropic key required on this stack.

## 11. Delivery
Single Lovable app (spec's `apps/web`) + `supabase/migrations` + `scripts/seed-demo.ts`
+ `docs/`. Edge functions are replaced by server functions; the Expo app is deferred.
Legal gates (pharmacy agreement, insurance DSA, PDPPL counsel review, DPIA) remain
process items — the code already enforces the technical boundaries they require.