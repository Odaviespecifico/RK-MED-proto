# RKMED Linha Gold — implementation plan

Baseline reviewed: `RKMED Levantamento  Requisitos MVP (Versão 02).docx` (cover version 2.0, May 2026). Planning date: 2026-10-06. Status: discovery in progress; an interactive frontend prototype exists in `prototype/`, while production backend/business integration is not implemented. Answers 1–27 incorporated. Twilio resolves phone delivery; dual verification and offline action rules are confirmed. Resend and both audited collection actions are confirmed; employee codes are confirmed once per work session. Remaining discovery is tracked below.

## Confirmed direction

Build a mobile-first, installable PWA using React (Vite, not Next.js), a sophisticated shadcn/ui design, and Supabase. Support the client view offline. Protect the administration panel through backend authorization. Bootstrap a reproducible local Supabase environment for development and testing.

The source defines a benefits club with public acquisition, adult enrollment, recurring subscription, a digital member card, partner discount recording, internal management, and WhatsApp/email communications. Partner payments happen outside RKMED. Six establishments across laboratory and gym/supplement segments are the baseline. Pilot size and dates are not planning blockers per the user.

## Source review and decision register

`Confirmed` reflects an explicit user instruction. `Proposed` is a recommendation awaiting an answer. `Open` blocks dependent business implementation, not unrelated setup.

| ID | Issue and source | Status / required decision |
| --- | --- | --- |
| D01 | §2 names both Next.js and Fastify | Confirmed: React/Vite, no Next. Proposed: Supabase Edge Functions + Postgres RPCs; API-only versus RLS browser reads still open. |
| D02 | §1.4 R$60; RF-LP-01/RF-PAG-01 R$69.90; RN-07 R$69.99 | Confirmed: R$69.60/month (6960 BRL cents); user answer 2026-10-06. All source prices superseded. |
| D03 | §1.2 100 subscribers vs RNF-04/RF-DG-11 200 | User: pilot size does not matter for current planning. Keep source load targets as engineering tests, not a subscriber cap. |
| D04 | Past June–August 2026 dates; required panels/landing scheduled after go-live | User: dates do not matter for current planning. Use ordered phases without a fixed deadline. |
| D05 | §1.3 no persistent login vs RF-QR-01 own-user login and offline PWA | Confirmed: persistent member sessions without scheduled expiry; email verification plus WhatsApp/SMS using Twilio. First registration requires email OTP AND phone OTP; later logins accept either one. WhatsApp is primary, SMS fallback. Resend delivers email OTP and transactional email. Member login offers “Login com whatsapp” and “Login com email”. |
| D06 | §3.5/§8.2 rotating 120s QR vs RF-QR-02 UUID and RF-QR-05 cached QR | Confirmed: no rotation. Adopt revocable opaque static identifier, cached member card and online partner entitlement/photo validation. |
| D07 | RF-QR-08 forbids history/savings; RF-QR-10 requires savings report | Confirmed: card, savings totals/history, partner search, billing management and support are included. Retain synced content offline indefinitely; disable all connectivity-dependent actions offline, with no queue. |
| D08 | RF-PAG-05/07, RN-09, §8.4 disagree on retry timing and delinquency | Confirmed: immediate benefit loss; retries D+0/1/3; seller sees ineligibility. Add an admin support/collections section for failed payments and manual collection. |
| D09 | RN-20 active-only vs RN-11 canceled access through paid cycle | Proposed: separate billing status, paid-through entitlement, cancellation scheduling, and manual block. |
| D10 | RF-PP-13 manager/96h vs RN-16 attendant/24h | Latest answer supersedes 96h: no time limit for reversals in admin panel by admins/RK support; retain reason and audit. |
| D11 | RF-CAD-07/RN-04 six-digit PIN vs §8.1 four-to-six and RF-CAD-12 login recovery | Confirmed: no member PIN. No-phone fallback is authenticated partner exact CPF search plus visual photo confirmation and live eligibility. |
| D12 | RF-CAD-06 1200px vs §8.1 600px; face detection comment | Confirmed: face detection only, not identity verification. Image dimensions, HEIC processor and failure fallback remain open. |
| D13 | Shared partner login plus employee code vs manager actions/auditable staff | Confirmed: shared partner account plus employee code validated against admin-managed establishment employee list. Enter/validate code once per work session; server binds employee attribution until operator switch/logout/expiry. |
| D14 | RNF-07 8h/12h JWT, no refresh vs RF-PP-17 8h inactivity | Existing admin provisions staff using email/password; no mandatory MFA. Members remain signed in indefinitely via refreshed sessions. Staff-specific absolute/idle limits remain open. |
| D15 | §6 INT-STR lists foreign event/header/endpoint conventions | Correct technical contract: Stripe SDK/API, Stripe-Signature, raw-body verification, invoice/subscription events; see references. |
| D16 | Clickwrap in stack vs go-live contract generation/signing | Open: versioned clickwrap sufficient, or external signing/document generation required? |
| D17 | RF-NOT-03 sales notified vs RF-PAG-06/member lifecycle notices | Open: exact event-to-recipient matrix, commercial role and escalation channels. |
| D18 | RF-ADM-06 segment rate vs RN-12 unique partner rate | Proposed: segment defaults with explicit partner override, snapshot at transaction time. Confirm precedence. |
| D19 | §6 bans browser Supabase client; user requests Supabase backend | Proposed: RLS-scoped safe reads/Auth directly, privileged workflows through Edge Functions. Confirm whether all data must go through API. |
| D20 | RF-CAD-11 localStorage drafts vs CPF/photo/PIN minimization | Proposed: no persistent sensitive enrollment draft; opt-in minimal draft only after privacy decision. |
| D21 | Retention/incidents/consent assertions and missing referenced legal documents | Not approved. User requested test mocks with exact AI-generated warning. Added docs/legal-mocks; replacement/approval required before real enrollment. |
| D22 | Budget table contradicts totals, gateway fees, plans, and currencies | Frontend hosting managed by user, likely Vercel. vercel.json added for future Vite build. Backend/provider ceiling remains open. |
| D23 | Browser last-two-years vs iOS 14+/Android 8+ | Confirmed: Portuguese interface, Android and iPhone mix. Exact minimum OS/browser versions and test devices remain open. |
| D24 | Version cover 2.0 vs history 1.0; missing IDs/module count/cross-references | Preserve original IDs (including RP-PP-12 typo) with aliases; do not invent missing requirements. Referenced contracts/approvals/Figma were not supplied. |
| D25 | CPF visibility and lookup | Confirmed: admins cannot view full CPF. Enforce masked server responses and UI; exact authorized lookup remains allowed. Apply the restriction to support/viewers as well; no full CPF in exports. |

Questionnaire: `docs/discovery.md`. User answers supersede proposed defaults. Record answer, date, owner and affected requirement IDs here as decisions arrive.

## Architecture proposal

```text
React/Vite + shadcn/ui
  public: /, /parceiros, /cadastro, /termos, /privacidade
  member: /app/cartao, /app/economia, /app/parceiros, /app/cobranca, /app/suporte
  partner: /parceiro/* — online
  internal: /admin/* — online, admin/support/viewer authorization
        |
        +-- Supabase Auth + RLS-scoped reads (pending D19)
        +-- Supabase Edge Functions: enrollment, card validation,
        |   transaction commands, billing, webhooks, notifications
        +-- PostgreSQL: entitlement, atomic money operations,
        |   RLS, append-only audits, idempotency, durable outbox
        +-- Private Storage: processed member photos
        +-- Stripe / Twilio WhatsApp+SMS / Resend email (test/fake locally; no Z-API)
```

One repository and deployment unit initially. No microservices or custom authentication system. Use server-owned role assignments. Evaluate Edge runtime compatibility for image conversion, OTP delivery, and scheduled jobs before committing to libraries; HEIC may need a dedicated processing service. A small additional worker is justified only by a proven constraint.

Roles include member, shared partner account with employee code, admin, RK support, and viewer. Admins and RK support may perform operational changes; exact support permissions remain to be scoped. Mandatory MFA was declined. Viewers may see identifiable member records, with exact fields pending, but cannot mutate or export. Supabase roles are distinct from business roles.

Treat self-service signup as member-only. Never accept staff roles in enrollment data. Confirmed: an existing admin provisions staff with email/password. Bootstrap the first admin through a trusted operator process, not public role assignment. Session revocation/role changes must be enforced server-side rather than waiting solely for stale claims.

## Offline design decision

The explicit user requirement is an offline member view. First authentication and initial download still require a connection. Proposed baseline caches the application shell and minimum own-card snapshot (name, photo if approved, card reference, last-known status, last-sync time). Cache the partner directory, savings totals/history, billing summary and support information too. Retention has no application-imposed expiry. Browser eviction, explicit logout and account switching still clear data. Payments, subscription mutations, OTP, support-message sending and all other connectivity-dependent actions are disabled offline. Show a reconnect explanation; never queue these actions. Cached billing status must say it is outdated and cannot authorize a sale.

Confirmed protocol: a high-entropy, revocable opaque static card identifier, unrelated to CPF/Auth UUID. The online partner resolves it through a narrowly authorized endpoint, checks current entitlement and photo, then commits the sale with another entitlement check. The identifier never grants login or general profile access. It survives offline cold launch but is reusable if photographed; photo confirmation, revocation, rate limits and audit reduce rather than eliminate that accepted risk. QR does not rotate. Revocation/reissue must replace the credential and refresh the local snapshot on reconnect.

No PIN is used. Confirmed no-phone/battery fallback: the authenticated partner enters the exact CPF, the server returns minimum name/photo/eligibility with masked CPF only, and the employee confirms the photo matches the person. Rate-limit and audit lookup attempts, require an active verified employee code, and never offer public or wildcard CPF search. Clear the transient input after lookup. Partners always remain online.

Cache rules: allowlisted static/member-shell assets only; explicit account-scoped IndexedDB snapshots; no generic API caching; no staff data; no QR access secrets in analytics. Purge on logout/account switch. Members remain signed in indefinitely with persisted rotating refresh tokens. Expired access tokens do not erase the offline snapshot; reconnect must refresh or request reauthentication if revoked. Pending decisions: trusted-device consent and local lock. An offline phone cannot receive immediate remote revocation; live partner validation preserves the transaction boundary.

Service worker updates must not interrupt camera/enrollment/payment flows. Prompt for reload, migrate snapshot schema, clear obsolete caches. Provide an online-required message for checkout, profile changes, login and partner/admin actions. Browser storage can be evicted; a missing snapshot must lead to a helpful reconnect screen.

## Proposed data model (not yet migrated)

| Entity | Purpose and boundaries |
| --- | --- |
| profiles / member_private | Own basic identity vs restricted normalized CPF, birth date, contact details; unique CPF in server-controlled storage. Exact server-side CPF lookup; staff outputs masked only. Decide keyed lookup/encryption and authorized recovery. |
| role_assignments / partner_staff | Server-controlled role/establishment mapping plus admin-managed active employee list/code validation; no self-promotion. |
| partners / discount_policies | Public approved listing separated from credentials/internal fields; effective rates and status. |
| subscriptions / membership_entitlements | Provider IDs, billing state, paid-through period, cancellation request, independent manual block/reason; reconcile with provider. |
| consent_records / document_versions | Accepted terms/privacy/photo versions, timestamps and approved evidence. |
| member_credentials | Restricted hash of revocable static card credential; no PIN. Return raw credential only to its authorized owner when issued. |
| validation_attempts / validation_receipts | Durable throttling, partner/member binding, short expiry, single-use receipt consumed by transaction commit. |
| transactions / reversals | Integer cents, rate snapshot, partner/member/actor, idempotency key; at most one full reversal unless partial reversals approved. |
| webhook_events | Unique provider/event ID, processing status, retry metadata; minimize payload retention. |
| notification_outbox / deliveries / preferences | Transactional enqueue, channel/template versions, retry/fallback and opt-out state; avoid duplicate sends. |
| audit_events | Trusted append-only events; scoped visibility; no raw credential/PII leakage. |

All exposed tables need RLS and least-privilege grants in the same migration. Sensitive tables live in an unexposed schema. Foreign keys, uniqueness and check constraints enforce financial/identity invariants. Security-definer functions must check authorization and have constrained search paths/grants. Derived reports should not accidentally bypass RLS through owner-executed views.

## Critical workflows

- **Enrollment (RF-CAD, RN-01–05):** validate adult age/CPF/duplicates, contact identity, upload and process photo, complete both email OTP and phone OTP verification through Supabase Auth (Twilio WhatsApp with SMS fallback), record approved consent, create incomplete enrollment, open Stripe Checkout. Handle abandoned/retried signup without duplicate identities/subscriptions. Do not activate on redirect.
- **Billing (RF-PAG, RN-07–11):** price is 6960 BRL cents/month; first failed payment immediately removes benefits and is visible to the seller. Retry schedule is D+0/1/3. Server selects Price ID, verifies raw webhook signatures, durably records event before acknowledgement, deduplicates, handles out-of-order events, updates entitlement and enqueues notifications transactionally. Reconcile missed events. Monthly billing follows the provider's calendar anchor rather than adding 30 days.
- **Counter (RF-PP, RN-12–20):** authenticated online partner validates static card or performs exact CPF lookup plus photo confirmation, sees only minimum name/photo/status, confirms identity, inputs gross amount, reviews server totals, commits using bound validation receipt and idempotency key. Validate employee code against the admin-managed active list once at work-session start and bind employee/establishment to server-side work-session context. Recheck partner, employee and member active state at commit without asking for the code on every sale. Provide “Trocar funcionário” to validate a different code; end context on logout/account switch/expiry, preserving historical attribution. Two taps or retries create one record.
- **Verification and sessions:** Supabase Auth owns identity, verification and sessions; Twilio supplies WhatsApp/SMS delivery. First registration requires both email OTP and phone OTP; phone delivery uses WhatsApp with SMS fallback through Twilio. Later logins require either email OTP or phone OTP, not both. Resend delivers email OTP and transactional emails. Present exactly “Login com whatsapp” and “Login com email” as the two member login options; SMS is a fallback inside the WhatsApp flow, not a third primary option. Keep verified email and phone on the same Auth identity/member; do not create duplicate member accounts when changing channels. Gate enrollment completion/checkout on both server-verified contact claims, not UI flags or a session created by the first OTP. Attach and verify the second contact on the same authenticated identity with duplicate-contact checks; never auto-merge unrelated accounts. Subsequent sign-in accepts either verified contact. Use throttling, resend cooldowns, bounded attempts and redacted logs. SMS fallback is bounded and observable; delivery can fail on both channels, so show retry/help rather than promising guaranteed receipt. Reconcile the provider/Supabase challenge lifecycle so fallback cannot bypass expiry or attempt limits. Local tests do not send real messages. Persist member sessions with automatic refresh and rotating refresh tokens, no imposed lifetime/idle expiry; access JWTs still expire normally. Logout/revocation/storage clearing can end sessions. Staff policies remain distinct. Number/email recovery needs a reviewed support process; no member PIN.
- **Reversal:** scoped admin/support checks without a time window, mandatory reason, append linked record and audit in one transaction, adjust aggregates without deleting source. No payment gateway refund from reversing a discount record.
- **Notifications (RF-NOT):** outbox worker with bounded retry/backoff, channel fallback, deduplicated reminders, and failed-delivery queue. Separate transactional notices from opt-out marketing; approve legal classifications. Jobs and callbacks are authenticated. Local tests do not contact real people.
- **Collections/support:** add `/admin/cobrancas` for admins/RK support: named overdue members, masked CPF, invoice/due amount and date, failure status, last attempt, contact details as authorized, and audited contact/collection history. Confirmed actions: send a Stripe payment/update-card link and retry the existing unpaid invoice. Both require an explicit confirmation screen showing the member, selected invoice/action and applicable amount; enforce admin/support permissions and append audit records for request and outcome. Use a durable operation key plus provider idempotency for retries, recheck invoice eligibility immediately before acting, and reconcile already-paid/in-flight invoices with webhook updates. Disable repeat submission while pending; do not rely on this UI control alone. A later intentional retry must follow reconciliation and receive a new operation key. Link sending is deduplicated independently and never starts a charge by itself. Never duplicate an invoice/debt, treat a reminder as payment, or manually bypass provider-confirmed eligibility. Prevent duplicate commands and handle simultaneous webhook updates. Viewer role has no collection actions.
- **Administration (RF-ADM/DG):** safe audited partner/member controls, read-only viewer projections, protected exports with spreadsheet formula-injection handling, no bulk PII export by viewers. Realtime critical alerts; aggregated charts refresh on demand.

## Visual and experience direction

Confirmed direction: warm ivory background, charcoal text, muted gold accents, refined typography and generous spacing. Membership card is the visual anchor; use restrained effects and sharp hierarchy instead of decorative clutter. shadcn components share tokens and accessible focus/contrast. Validate logo/fonts/license and brand assets before finalizing.

Member mobile screens emphasize a large card/QR, readable status, offline timestamp, one clear next action, and support. Partner screens emphasize camera/CPF-photo fallback selection and large confirmation controls. Internal desktop/tablet screens use a compact sidebar, clear KPIs, filterable tables, and intentional density. Use Portuguese-only copy, BRL and Recife business dates; target Android and iPhone.

Proposed quality bar: 360px with no horizontal overflow, 44px targets, keyboard/screen-reader coverage, WCAG AA contrast, reduced-motion support, LCP <2.5s and CLS <=0.1 (stricter than the source's 0.5). Landing <3s under an agreed reproducible throttling profile; score >85 as source baseline. Put share metadata in initial HTML/static prerender output so previews work without Next.js or client-only metadata execution.

## Delivery phases and acceptance gates

| Phase | Deliverables / requirement trace | Exit criteria |
| --- | --- | --- |
| 0 — Discovery and local foundation | Decision register, user questionnaire, local Supabase config/tooling, smoke-test harness (RNF-29/31/32) | Docker reachable; clean local migration/seed; SQL tests pass; priority conflicts answered before dependent features. |
| 1 — React shell and design | Vite/TS, router, Tailwind/shadcn tokens, layouts, fixture screens, manifest/icons, cache boundary (RF-LP, RF-QR-06, RNF-25–27) | Build/type/lint pass; reviewed 360px/member and desktop/staff designs; install and shell offline reload demonstrated. |
| 2 — Identity and authorization | Auth, roles, invitation flow, staff access controls, RLS/storage, session controls, audit (RF-DG-01/09/10, RNF-05–09/16) | Negative API/RLS tests prevent self-promotion, viewer mutation, cross-partner access and unauthenticated admin calls. |
| 3 — Enrollment and billing | Photo/consent/email + Twilio verification, checkout, lifecycle webhooks/reconciliation, local provider fakes (RF-CAD/PAG, source PIN requirements removed) | Sandbox enrollment activates only from verified payment; failed/duplicate/out-of-order events and cancellation boundaries tested. |
| 4 — Card and partner operation | Approved static QR/offline contract, live entitlement, camera/CPF-photo fallback, atomic discount/reversal/history (RF-QR/PP) | Member cold-launch offline passes; revoked card rejected by online partner; concurrent duplicate submissions yield one sale; OTP abuse/reversal boundaries pass. |
| 5 — Administration and communications | Partner/member management, KPIs/CSV, audited collections/support, outbox/delivery/alerts (RF-ADM/DG/NOT/SUP) | Fixture KPI reconciliation; viewer denied exports; failure/retry/fallback and opt-out scenarios pass. |
| 6 — Public launch and hardening | Real content, SEO/OG, performance, real-phone QA, provider staging, privacy/ops documentation (RF-LP, RNF) | Full acceptance matrix green, legal/content approval, backup restoration and rollback exercised in staging, monitoring configured, launch date agreed. |

**User priority: scan QR → register purchase.** After the secure shell/authorization foundation, implement phase 4 against synthetic paid-member fixtures before phase 3 provider integration. Prove static QR resolution, current eligibility, photo confirmation, server-calculated discount and idempotent purchase recording first. Then connect enrollment, billing, notifications and member reporting. Mock fixtures never establish real paid entitlement. Lower-priority analytics, ranking (RP-PP-12), onboarding campaigns and extended charts can be deferred by explicit scope decision. Do not ship with incomplete ALTA requirements merely because the source schedule placed them later.

## Verification matrix

- Unit: CPF/age date boundaries, OTP attempt/expiry rules, BRL rounding, discount ranges, entitlement/grace/cancellation/manual-block precedence, report calculations.
- Database: default-deny grants and RLS; role/tenant isolation; private photo policies; non-forgeable validation receipts; concurrency, idempotency, one reversal and append-only audits.
- Authentication: first OTP alone cannot complete enrollment or open checkout; verified email + verified phone can. Both labeled login options resolve to the same member through the chosen channel alone; SMS fallback stays within WhatsApp login. Test WhatsApp failure/SMS fallback, both-channel failure, replay, expiry, duplicate contacts, account-linking abuse and revoked refresh tokens.
- Integration: invalid/replayed/out-of-order Stripe signatures/events; payment recovery and reconciliation; durable outbox failure recovery; retry limits and duplicate notification suppression.
- Privacy/operation: exact CPF search succeeds for authorized staff but full CPF never appears in response payloads, hydrated data, exports, logs or local caches; revoked/cross-partner employee codes cannot commit sales; work-session reuse requires no repeated code entry, operator switching changes only future attribution, and logout clears the employee context; reversals older than 96h succeed for authorized admins/support; collections commands reject viewers and duplicate requests.
- E2E: enrollment/payment sandbox, installed cold-launch offline, refresh/reconnect, expired tokens, storage eviction, logout then another account, server block while member offline, staff offline denial, camera refusal/approved no-phone fallback, admin session expiry, viewer denial.
- Performance: source API p95 <=500ms and scan-to-result <=2s against a documented representative environment; 50 simultaneous transactions; enrollment <5min and partner flow <90s in observed usability tests.
- Operations: fresh clone + local start/reset/test, separate staging/prod configuration, migration rollback/forward recovery, DB **and storage object** backup/restore, redacted logs, coarse public health and internal alerts. Database backups alone do not restore uploaded image bytes.

## Hosting and legal fixtures

User manages frontend deployment. `vercel.json` declares Vite, `npm run build`, and `dist`; filesystem routes serve actual assets before SPA fallback, missing PWA/asset files return 404, hashed assets are immutable, and the service worker/manifest/HTML revalidate. The frontend now exists under `prototype/`; its build and browser walkthrough passed locally. The root Vercel config builds `prototype` and outputs `prototype/dist`, while `prototype/vercel.json` supports choosing the folder as Vercel root. A live Vercel preview still needs deployment under the user’s hosting account. Check deep-link reloads and PWA upgrades in Vercel preview once implemented. See [Vercel Vite guidance](https://vercel.com/docs/frameworks/frontend/vite).

`docs/legal-mocks/` includes terms, privacy, photo notice and notification templates. Every test page/message must visibly include: **Esse texto deve ser modificado por ter sido inteiramente gerado por IA e serve apenas para testes.** Mock consent versions are never accepted as real production consent.

## Local bootstrap status

See `README.md` for executable commands and current verification results. The initial migration intentionally creates only a private bootstrap marker and pgTAP smoke tests, not a prematurely finalized billing schema. `prototype/` provides the design and frontend flows with fictional local data, including live camera face detection during enrollment, still-photo validation, QR scanning, purchase/savings, and staff views. Its authentication and payment actions are simulations; Supabase-backed enforcement remains to be built. Business fixtures and role tests belong to phases 2–4. Camera operation still needs real Android and iPhone verification over HTTPS.

Production deployment, live payments/messages and remote Supabase projects are outside this bootstrap. Secrets are supplied through ignored environment files/secret stores. No user password is required in chat.

## Technical references checked during planning

- [Supabase local development](https://supabase.com/docs/guides/local-development): project-local CLI and Docker stack.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) and [MFA](https://supabase.com/docs/guides/auth/auth-mfa): database authorization and assurance enforcement.
- [shadcn/ui with Vite](https://ui.shadcn.com/docs/installation/vite): React/Vite setup.
- [Stripe webhooks](https://docs.stripe.com/webhooks) and [subscription events](https://docs.stripe.com/billing/subscriptions/webhooks): signature verification and real event contracts. Relevant candidates include `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, and `customer.subscription.deleted`; verify chosen API version and event payloads during implementation.

These references correct technical integration contracts, not unresolved business or legal policies. Prices, retention duties and legal deadlines are deliberately not asserted from the draft.

- [Supabase Send SMS Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook) and [phone authentication](https://supabase.com/docs/guides/auth/phone-login): support the WhatsApp OTP integration decision; Z-API has been removed by the user. Validate hook signature, provider outage behavior and plan availability before implementation.

- [Supabase sessions](https://supabase.com/docs/guides/auth/sessions): persistent refresh-based sessions with short-lived access tokens. [Phone sign-in](https://supabase.com/docs/guides/auth/phone-login) supports WhatsApp through Twilio/Twilio Verify; email transport remains a separate choice.
