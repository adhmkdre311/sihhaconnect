# API.md

There is no REST surface for app-internal logic. Everything is a typed server function
(`createServerFn`, called from React via `useServerFn`) declared in `src/lib/*.functions.ts`.
Auth-protected functions carry `requireSupabaseAuth`; the bearer token is attached by the
client middleware in `src/start.ts`. Straight reads/writes that RLS already scopes go
directly through `supabase` from `@/integrations/supabase/client`.

## Conventions

- Inputs validated with Zod in `.inputValidator()`; invalid input throws before the handler.
- Handlers read secrets from `process.env` inside the handler, never at module scope.
- Privileged work uses `supabaseAdmin` (`client.server.ts`), only after the caller's role
  is verified through the RLS-scoped client.
- Errors surface as thrown `Error` (message shown to the user) or `Response` 401/403.

## Function catalogue

### Auth / roles — `roles.functions.ts`
`bootstrapWorker`, `bootstrapEmployer`, `bootstrapClinicStaff`, `acceptConsent`,
`addWorkerToEmployer`, `setWorkerActive`, `sendBroadcast`

### Staff onboarding & partners — `staff.functions.ts`
`listStaffOrgDirectory` (public, sign-up picker), `requestStaffRole`, `listPendingStaff`,
`approveStaffRequest`, `denyStaffRequest`, `createPharmacy`, `createInsurer`,
`linkInsurerEmployer`, `listOrgs`, `addMedication`, `getMyPharmacyStock`, `setStock`,
`searchMedicationAvailability`, `logPharmacyLookup`, `getInsurerAggregates`,
`listInsurerClaims`

### Clinic — `clinic.functions.ts`, `clinicStaff.functions.ts`, `clinicWalkIn.functions.ts`
`translateContextNote`, `clinicAddDocument`, `getMyClinicPerms`, `listClinicTeam`,
`updateClinicStaffPermissions`, `removeClinicStaff`, `inviteClinicStaff`,
`revokeClinicInvite`, `previewClinicInvite`, `acceptClinicInvite`,
`findWalkInWorker`, `createWalkInAppointment`

### Employer — `employerInvites.functions.ts`, `compliance.functions.ts`
`listEmployerInvites`, `createEmployerInvite`, `revokeEmployerInvite`, `getComplianceRule`

### Pharmacy hub — `pharmacyHub.functions.ts`
`listMyAvailability`, `addAvailability`, `setAvailability`, `removeAvailability`,
`getPharmacyVisibility`, `updateMyPharmacy`, `searchAvailability`,
`logAvailabilityLookup`, `getNetworkOverview`

### Directory — `directory.functions.ts`
`listClinicDirectory` (replaces anonymous SELECT on `clinics`/`clinic_slots`)

### AI — `ai.functions.ts`, `speech.functions.ts`
`askAssistant`, `summarizeDocument`, `generateVisitContext`, `translateVisitSummary`,
`transcribeVoiceNote`. Model `google/gemini-2.5-flash` via the Lovable AI Gateway;
guardrail runs on every prompt and response; scripted fallbacks ship if the gateway is down.

### Announcements — `announcements.functions.ts`
`listAnnouncements`, `createAnnouncement`, `updateAnnouncement`,
`setAnnouncementPublished`, `deleteAnnouncement`, `listEmployersLite`

### Platform admin — `adminConsole.functions.ts`
`getAdminDashboard`, `listPlatformUsers`, `updateUserAccess`, `listAllOrgs`, `saveOrg`,
`deleteOrg`, `saveOrgLink`, `deleteOrgLink`, `pushBroadcast`, `listAdminRecords`,
`deleteAdminRecord`, `getAdminAnalytics`, `listAuditLogs`, `listPlatformSettings`,
`updatePlatformSetting`

### Support tooling — `viewAs.functions.ts`, `email.functions.ts`
`recordViewAs` (audited read-only impersonation), `sendEmail` (Resend)

## HTTP route handlers

| Route | Method | Purpose |
| --- | --- | --- |
| `/lovable/email/auth/webhook` | POST | branded auth emails; verifies the signed payload |
| `/lovable/email/auth/preview` | GET | template preview for the auth email set |

New external/webhook/cron endpoints belong under `src/routes/api/public/*` and must verify
the caller inside the handler.

## Database RPC

`public.send_broadcast(...)` — fan-out of notifications, called by `sendBroadcast`/`pushBroadcast`.
SECURITY DEFINER helpers (`my_role`, `is_admin`, ...) are used by policies only; `anon`
and `PUBLIC` have no EXECUTE rights.