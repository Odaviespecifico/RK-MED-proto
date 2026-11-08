# RKMED Linha Gold — agent guidance

## Authority and current scope

1. Follow the user's latest explicit decisions first.
2. Read `plan.md` and its decision register before implementing business behavior.
3. Use `RKMED Levantamento  Requisitos MVP (Versão 02).docx` as the baseline, preserving requirement IDs in backlog items and relevant tests. Do not modify this source document.
4. Unresolved contradictions are not approved requirements. Implement independent foundations; ask targeted questions before encoding disputed billing, eligibility, identity, or retention policies.

The application lives at the repository root (`src/`, `public/`, Vite config and one package/lockfile). `prototype/` is an archived pointer. `src/mocks/` contains the isolated demonstration and fake browser sessions. Sandbox mode uses real local Supabase Auth, narrow RPCs with RLS, private Storage and privileged Edge Functions. Server-only provider adapters live under `supabase/functions/_shared/providers/`. Local enrollment, card, counter, administration and provider workflows are implemented; external-provider, device and production acceptance remain pending. See `docs/homologacao.md` for verified coverage. Keep demo and sandbox sessions/data separate and never fall back to mock success on provider failure. See `docs/desenvolvimento.md` for current commands and limitations.

## Fixed technical direction

- React with Vite and TypeScript; **no Next.js**, Next server actions, or Next API routes.
- shadcn/ui with Tailwind CSS for accessible, sophisticated interfaces. Reuse design tokens and primitives; avoid a collection of unrelated dashboard templates.
- Supabase PostgreSQL, Auth, private Storage, migrations, and local Docker development.
- Confirmed backend: Supabase Edge Functions for privileged workflows and providers, PostgreSQL functions for atomic operations. Do not add a separate Fastify service unless a demonstrated runtime need warrants it.
- Proposed frontend libraries: React Router, TanStack Query, React Hook Form, Zod, and a Vite-compatible PWA/Workbox integration. Verify current compatibility when installing and commit a lockfile.
- The root application keeps public, member, partner, and internal route areas in one frontend; the demonstration remains isolated from sandbox adapters. Lazy-load privileged panels, charts, and camera readers.

## Business invariants

- First delivery priority is scanning the member QR and registering a purchase. Prove this with synthetic paid-member fixtures before integrating full enrollment/billing.
- Facial processing detects presence of a face only. Stripe is confirmed; RKMED owns OTP generation and verification for both email and SMS; SMS Dev transports SMS only (D29). Supabase Auth remains the session store through an isolated server-side session bridge. Resend delivers verification and transactional emails. Existing Twilio code is legacy awaiting migration, not an approved delivery path; see D26 in `plan.md`.
- Legal text is unapproved. Use `docs/legal-mocks/` only in tests with the exact visible AI warning; production must reject mock document versions.

- Confirmed price: R$69.60/month (6960 cents). Payment failure immediately removes benefits; retries occur on D+0, D+1 and D+3. The seller must see ineligibility.
- Shared partner account plus employee code is confirmed. Directors see name, masked CPF, membership status/dates and savings, without contacts, photos, exports or mutations. Admins and RK support manage operational actions; only admins provision staff.
- Admins/RK support reverse records from the admin panel without a time limit, retaining reasons and audit. Pilot size/date are not planning blockers per the user.

- RKMED records partner discounts; customers pay partners directly. Partner purchases have no splits or commissions. Membership revenue sharing follows D27 in `plan.md`; medical records, diagnoses and exam categories remain outside scope.
- Adult individual membership only. Family plans, native apps, pharmacy, referrals, physical cards, ERP, chatbots, and browser push remain outside the baseline MVP.
- Monetary values use integer BRL cents; discounts use integer basis points. Compute totals on the server and snapshot the applied rate on each transaction. Round half-cent upward. Use the explicit partner rate and enforce safe-integer technical bounds; no commercial purchase cap is approved.
- Membership entitlement is checked on the server at validation **and transaction commit**, including administrative blocks and paid-through cancellation dates.
- Record reversals as linked, auditable entries. Never erase original transactions or interpret a partner record reversal as a Stripe refund.
- Payment success pages never activate membership. Only verified provider events/reconciliation may establish payment.

## Authorization and privacy

- Never return a complete member CPF to staff/admin/viewer browsers, exports or logs. Display a masked value (proposed `***.***.***-12`) through a shared UI formatter, and enforce the same restriction in server projections. CPF can be entered transiently for exact authorized lookup; do not put it in URLs or persistent client storage. Do not fetch a raw CPF merely to hide it with CSS.
- Validate employee codes against the admin-managed active employee list for the authenticated establishment. Bind the employee to validation receipts and transactions, and recheck active status at commit. Enter and validate the code once per work session, not per sale. Bind the selected employee to server-side work-session context; provide “Trocar funcionário” to close that context and validate another code. Logout, account switch or session expiry clears it; historical purchases retain their original employee attribution.
- Members stay signed in without an application-imposed session lifetime or inactivity timeout. Use short-lived access tokens with rotating refresh tokens and persisted sessions; never issue an immortal JWT. Logout, revocation, lost browser storage and security events can still end a session. This does not extend staff sessions indefinitely.
- Add an admin/RK support collections section for failed payments, customer contact and manual collection actions. Support both sending a Stripe payment/update-card link and retrying the existing unpaid invoice. Each action requires explicit operator confirmation, audit and duplicate-charge protection; never create a second invoice for the same debt. Payment status and entitlement must stay provider-verified.

- UI route guards improve navigation; server authorization and RLS enforce access.
- Deny anonymous/member/partner access to internal data by default. Scope member records to their owner and partner records to their establishment. Viewers cannot mutate or export.
- Roles and partner assignments must be server-controlled. Never trust editable user metadata, request-supplied roles, or a partner ID without verifying membership.
- Mandatory MFA was declined. Protect staff operations with verified Supabase sessions, server-owned permissions, rate limits and audit. Existing admins provision staff using email/password for this version; never allow public self-assignment of staff privileges.
- Do not expose service-role/secret keys, Stripe secrets, webhook secrets, or messaging credentials through `VITE_*`, browser bundles, logs, or git. Browser Supabase access, if adopted, uses only a publishable/anon key with tested RLS.
- First registration requires email OTP and SMS OTP on the same Auth identity. Later login offers “Login com SMS” and “Login com email”, requiring only the chosen channel. RKMED issues/verifies both email and SMS challenges independently of Supabase OTP providers; use SMS Dev for transport and keep native Auth OTP delivery retired. See docs/smsdev-otp.md for the session bridge and configuration. Keep throttling, recipient allowlists and provider secrets server-side. No member PIN.

- Use private member photos, short-lived authorized access, upload validation, and metadata stripping. Face detection does not establish identity or liveness.
- Minimize personal data in logs and analytics. Never log CPF, PIN, QR credentials, auth links, access tokens, or full webhook payloads indiscriminately.
- Audits are append-only and written by trusted backend operations. Capture actor, action, target, reason, timestamp, and correlation ID with redaction.
- Protect every privileged function even when using the service-role key, which bypasses RLS. Restrict SQL function grants, validate callers, and set an explicit safe `search_path` on security-definer functions.
- Public health responses reveal only coarse status, never secrets or detailed infrastructure failures.

## PWA and offline contract

- Include card, savings totals/history, partner search, billing summary/management, and support. Saved member content remains offline indefinitely; browser eviction and account logout still remove it. All connectivity-dependent actions are unavailable offline; disable them with a clear reconnect message and never queue them for later execution.

- Offline support is for the member experience. Partners and internal staff require connectivity for operational actions.
- Cache the member shell and explicitly approved member snapshot fields. Show offline state and last-sync time; cached subscription status is not live eligibility.
- The confirmed QR is static: a high-entropy revocable opaque identifier. The online partner must resolve it and check current entitlement; cached member status cannot authorize benefits. Do not implement rotating QR tokens.
- Do not queue payments, partner sales/reversals, or admin changes for offline replay.
- Never blanket-cache Supabase/API responses, auth callbacks, signed URLs, partner records, admin pages containing data, or provider endpoints. Use an explicit cache allowlist.
- Scope IndexedDB data by account, retain confirmed member snapshots without an application-imposed expiry, and clear it on logout/account switch. Isolate member offline caches from staff sessions on shared devices. Document that browser storage is not protection from someone who controls an unlocked phone.
- First login and initial download need connectivity. Handle storage eviction, expired sessions, installed-app cold launches, update prompts, and failed refresh without showing another user's information.
- PWA installation, offline reload, camera access, and deep links must be tested on real target phones over HTTPS. Desktop emulation alone is insufficient.

## UI and accessibility

- Confirmed language: pt-BR, BRL formatting, and America/Recife for business dates; store timestamps in UTC. Target both Android and iPhone.
- Confirmed visual direction: warm ivory, charcoal, restrained gold, generous spacing, clear typography, subtle borders, and a premium digital membership card. Gold must not compromise contrast.
- Design first at 360px width. Prefer 44px touch targets, visible focus, labeled inputs, keyboard navigation, readable type, and status conveyed by text as well as color.
- Provide loading, empty, error, offline, denied, expired-session, and successful-action states. Explain failures in plain Portuguese.
- Keep the member card fast and immediately accessible. Partner flows prioritize scanning, identity confirmation, and clear gross/discount/final totals. No-phone fallback is exact CPF search followed by visual photo confirmation; no PIN. Internal pages prioritize readable tables and filters.

## Suggested structure when implementation starts

```text
src/app/                 routing, providers, layouts
src/features/           landing, enrollment, membership, partner, admin, billing
src/components/ui/      shadcn primitives
src/lib/                validated config, Supabase client, formats
src/offline/            snapshot schema, cache lifecycle, service worker integration
supabase/migrations/    reviewed schema, RLS, grants, functions
supabase/functions/     privileged API and integration adapters
supabase/tests/         pgTAP authorization and integrity tests
tests/e2e/              browser journeys and offline isolation
docs/                   discovery, decisions, API contracts, runbooks
```

## Development and validation

- `npm ci` installs the pinned local tooling. See `README.md` for Docker prerequisites and Supabase commands.
- `npm run db:reset` destroys and recreates the **local** database; never redirect it to a shared project. Do not use `db push` against a remote project without a requested deployment.
- Keep migrations immutable after application to shared environments. Use subsequent migrations for corrections. Seed only clearly synthetic data and keep external providers in test/fake mode locally.
- Each new table needs explicit grants/RLS and authorization tests. Test unauthorized direct API calls, cross-member/partner reads, self-promotion, viewer writes/exports, storage access, and administrator authorization.
- Test concurrency/idempotency for money operations, OTP abuse controls, reversals, and webhook replay/out-of-order delivery. Use real local Postgres for these tests.
- Run relevant checks once per change: typecheck/lint/build, targeted unit tests, local SQL tests, and affected E2E journeys as they become available. Never claim a check passed if Docker or another dependency blocked it.
- Keep `plan.md` statuses and the decision register aligned with actual progress. Separate implemented, proposed, verified, and blocked work.
