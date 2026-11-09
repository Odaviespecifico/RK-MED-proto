> D29 supersedes D28: RKMED owns email/SMS OTP codes; SMS Dev is transport only. See docs/smsdev-otp.md.

> Decisão vigente: OTP por SMS substitui WhatsApp; ver D28 abaixo.

# RKMED Linha Gold — implementation plan

Baseline reviewed: `RKMED Levantamento  Requisitos MVP (Versão 02).docx` (cover version 2.0, May 2026). Planning date: 2026-10-06. Status: implementação conectada em homologação; backend publicado no Supabase de testes em 08/11/2026 (ver registro abaixo). Domínio privado/RLS, Auth, foto validada no backend, cartão, balcão, compras idempotentes, estorno e gestão local implementados; endpoints Stripe/Resend e legado Twilio preparados e fechados sem credenciais. Em 04/11/2026, o usuário substituiu Twilio pela API oficial da Meta; migração do transporte WhatsApp pendente (D26). Provedores reais de teste, QA em celulares e demais critérios da matriz continuam pendentes. Decisões de arquitetura e controles foram confirmadas/delegadas em 2026-10-19. O [roteiro atual](docs/homologacao.md) separa execução local de aceitação externa.

## Confirmed direction

Build a mobile-first, installable PWA using React (Vite, not Next.js), a sophisticated shadcn/ui design, and Supabase. Support the client view offline. Protect the administration panel through backend authorization. Bootstrap a reproducible local Supabase environment for development and testing.

The source defines a benefits club with public acquisition, adult enrollment, recurring subscription, a digital member card, partner discount recording, internal management, and WhatsApp/email communications. Partner payments happen outside RKMED. Six establishments across laboratory and gym/supplement segments are the baseline. Pilot size and dates are not planning blockers per the user.

## Source review and decision register

`Confirmed` reflects an explicit user instruction. `Proposed` is a recommendation awaiting an answer. `Open` blocks dependent business implementation, not unrelated setup.

| ID | Issue and source | Status / required decision |
| --- | --- | --- |
| D01 | §2 names both Next.js and Fastify | Confirmed: React/Vite, no Next; Supabase Auth, RLS-scoped reads/RPCs and Edge Functions for privileged actions (D19). |
| D02 | §1.4 R$60; RF-LP-01/RF-PAG-01 R$69.90; RN-07 R$69.99 | Superseded by D30 (2026-11-08): official price is R$69.90/month (6990 BRL cents), matching the existing Stripe price. The 2026-10-06 answer of R$69.60 is historical. All source prices superseded. |
| D03 | §1.2 100 subscribers vs RNF-04/RF-DG-11 200 | User: pilot size does not matter for current planning. Keep source load targets as engineering tests, not a subscriber cap. |
| D04 | Past June–August 2026 dates; required panels/landing scheduled after go-live | User: dates do not matter for current planning. Use ordered phases without a fixed deadline. |
| D05 | §1.3 no persistent login vs RF-QR-01 own-user login and offline PWA | Confirmed: persistent member sessions without scheduled expiry; email verification plus WhatsApp using Meta's official API (D26 supersedes Twilio). First registration requires email OTP AND phone OTP; later logins accept either one. SMS fallback removed by the user on 2026-11-04 (D26). Resend delivers email OTP and transactional email. Member login offers “Login com whatsapp” and “Login com email”. |
| D06 | §3.5/§8.2 rotating 120s QR vs RF-QR-02 UUID and RF-QR-05 cached QR | Confirmed: no rotation. Adopt revocable opaque static identifier, cached member card and online partner entitlement/photo validation. |
| D07 | RF-QR-08 forbids history/savings; RF-QR-10 requires savings report | Confirmed: card, savings totals/history, partner search, billing management and support are included. Retain synced content offline indefinitely; disable all connectivity-dependent actions offline, with no queue. |
| D08 | RF-PAG-05/07, RN-09, §8.4 disagree on retry timing and delinquency | Confirmed: immediate benefit loss; retries D+0/1/3; seller sees ineligibility. Add an admin support/collections section for failed payments and manual collection. |
| D09 | RN-20 active-only vs RN-11 canceled access through paid cycle | Confirmed 2026-10-19: cancellation at the end of the paid period; payment failure/manual block override entitlement. Keep billing state, paid-through and scheduled cancellation separate. |
| D10 | RF-PP-13 manager/96h vs RN-16 attendant/24h | Latest answer supersedes 96h: no time limit for reversals in admin panel by admins/RK support; retain reason and audit. |
| D11 | RF-CAD-07/RN-04 six-digit PIN vs §8.1 four-to-six and RF-CAD-12 login recovery | Confirmed: no member PIN. No-phone fallback is authenticated partner exact CPF search plus visual photo confirmation and live eligibility. |
| D12 | RF-CAD-06 1200px vs §8.1 600px; face detection comment | Confirmed: face detection only, not identity verification. User delegated implementation choices 2026-10-19: 600×600 JPEG, 5 MiB input limit, metadata stripping; clear rejection/retry when conversion or face detection fails. HEIC only when conversion is supported. |
| D13 | Shared partner login plus employee code vs manager actions/auditable staff | Confirmed: shared partner account plus employee code validated against admin-managed establishment employee list. Enter/validate code once per work session; server binds employee attribution until operator switch/logout/expiry. |
| D14 | RNF-07 8h/12h JWT, no refresh vs RF-PP-17 8h inactivity | Existing admin provisions staff using email/password; no mandatory MFA. Members remain signed in indefinitely via refreshed sessions. User delegated policy 2026-10-19: staff maximum 8h and 30min inactivity, enforced server-side. Member sessions retain their confirmed independent policy. |
| D15 | §6 INT-STR lists foreign event/header/endpoint conventions | Correct technical contract: Stripe SDK/API, Stripe-Signature, raw-body verification, invoice/subscription events; see references. |
| D16 | Clickwrap in stack vs go-live contract generation/signing | Delegated decision 2026-10-19: versioned checkbox clickwrap with server timestamps and accepted document versions; external signature is outside this MVP. |
| D17 | RF-NOT-03 sales notified vs RF-PAG-06/member lifecycle notices | Delegated 2026-10-19: transactional notices to the affected member; operational failure/risk to the internal queue. No marketing automation. External delivery acceptance remains pending. |
| D18 | RF-ADM-06 segment rate vs RN-12 unique partner rate | Confirmed 2026-10-19: explicit rate per partner; integer basis points, half-cent rounded upward, snapshot at commit. No commercial purchase cap approved; enforce safe integer technical bounds. |
| D19 | §6 bans browser Supabase client; user requests Supabase backend | Confirmed 2026-10-19: Supabase Auth plus RLS-scoped reads/narrow RPCs; Edge Functions for providers and privileged integrations. |
| D20 | RF-CAD-11 localStorage drafts vs CPF/photo/PIN minimization | Delegated decision 2026-10-19: sensitive enrollment remains transient, no persistent CPF/photo enrollment draft. |
| D21 | Retention/incidents/consent assertions and missing referenced legal documents | Not approved. User requested test mocks with exact AI-generated warning. Added docs/legal-mocks; replacement/approval required before real enrollment. |
| D22 | Budget table contradicts totals, gateway fees, plans, and currencies | Frontend hosting managed by user, likely Vercel. vercel.json added for future Vite build. Backend/provider ceiling remains open. |
| D23 | Browser last-two-years vs iOS 14+/Android 8+ | Confirmed: Portuguese interface, Android and iPhone mix. Exact minimum OS/browser versions and test devices remain open. |
| D24 | Version cover 2.0 vs history 1.0; missing IDs/module count/cross-references | Preserve original IDs (including RP-PP-12 typo) with aliases; do not invent missing requirements. Referenced contracts/approvals/Figma were not supplied. |
| D25 | CPF visibility and lookup | Confirmed: admins cannot view full CPF. Enforce masked server responses and UI; exact authorized lookup remains allowed. Apply the restriction to support/viewers as well; no full CPF in exports. |

| D26 | WhatsApp delivery provider | Confirmed 2026-11-04: Meta's official API replaces Twilio. Adapter/hooks/configuration migration pending. SMS fallback removed on the same date; see provider decision below. |
| D27 | Wedea membership revenue share | Confirmed 2026-11-08: RKMed charges members; Wedea receives 1587 BRL cents per successful membership payment only with more than 200 currently paying members with active benefits. Count after payment reconciliation, including the newly activated member; blocked, expired and past-due members do not count. Apply to initial payments and renewals; falling to 200 disables subsequent shares. Persist each invoice decision, with no retroactive backfill. Wedea retains its share after refunds, disputes and chargebacks; RKMed bears those costs. Use Connect separate charges and transfers, not partner purchase splits. |
| D30 | Official monthly price | Confirmed 2026-11-08: R$69.90 (6990 cents), using the existing Stripe product `prod_UW2D4U86cqPJq7` and price `price_1TX08n6KdnsqbUqNy89AQzM2` without recreating or editing them. Supersedes the R$69.60 answer in D02. RKMed retains R$54.03 of a full R$69.90 payment before Stripe fees; the Wedea share remains R$15.87 (D27). |
| D31 | OTP email presentation | Confirmed 2026-11-09: the transactional access-code email is a branded HTML message with the code highlighted and no AI/mock warning. The mock warning remains on legal pages and notification templates. Rationale: the notice made the OTP email look like a test/phishing message and contributed to spam placement at Hotmail/Outlook. |

Questionnaire: `docs/discovery.md`. User answers supersede proposed defaults. Record answer, date, owner and affected requirement IDs here as decisions arrive.

## Provider decision — 2026-11-04 (D26)

Confirmed by the user: replace Twilio with Meta's official WhatsApp API directly. Supabase Auth remains responsible for OTP issuance, verification and sessions; Resend remains the email transport. First enrollment still requires both verified contacts, and subsequent login still offers WhatsApp or email. Twilio is no longer a service to configure or contract for this project.

Implementation pending: replace `supabase/functions/_shared/providers/twilio.ts`, migrate `auth-sms` and `phone-code`, replace environment examples/tests, and complete Meta delivery acceptance. SMS removal is implemented separately below. Existing hooks, allowlists and provider tests still use Twilio; recording this decision does not implement Meta delivery. Validate the current official API/template contract before implementation. Keep credentials exclusively server-side and retain signed Auth hooks, throttling and same-identity verification.

Confirmed in the follow-up on 2026-11-04: remove SMS fallback entirely. Phone codes use WhatsApp only. Email login is not proof of phone ownership. Historical milestones below record the former integration; they do not override D26.

## Confirmed architecture

```text
React/Vite + shadcn/ui
  public: /, /parceiros, /cadastro, /termos, /privacidade
  member: /app/cartao, /app/economia, /app/parceiros, /app/cobranca, /app/suporte
  partner: /parceiro/* — online
  internal: /admin/* — online, admin/support/viewer authorization
        |
        +-- Supabase Auth + RLS-scoped reads/narrow RPCs (confirmed D19)
        +-- Supabase Edge Functions: enrollment, card validation,
        |   transaction commands, billing, webhooks, notifications
        +-- PostgreSQL: entitlement, atomic money operations,
        |   RLS, append-only audits, idempotency, durable outbox
        +-- Private Storage: processed member photos
        +-- Stripe / Meta official WhatsApp API / Resend email (Meta migration pending; D26)
```

One repository and deployment unit initially. No microservices or custom authentication system. Use server-owned role assignments. Evaluate Edge runtime compatibility for image conversion, OTP delivery, and scheduled jobs before committing to libraries; HEIC may need a dedicated processing service. A small additional worker is justified only by a proven constraint.

Roles include member, shared partner account with employee code, admin, RK support, and viewer. Admins and RK support manage operational changes; staff provisioning is admin-only. Mandatory MFA was declined. Viewers see name, masked CPF, status/dates and savings; contacts, photos, mutations and exports are denied. Supabase roles are distinct from business roles.

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

- **Enrollment (RF-CAD, RN-01–05):** validate adult age/CPF/duplicates, contact identity, upload and process photo, complete both email OTP and phone OTP verification through Supabase Auth (WhatsApp via Meta's official API; migration pending under D26), record approved consent, create incomplete enrollment, open Stripe Checkout. Handle abandoned/retried signup without duplicate identities/subscriptions. Do not activate on redirect.
- **Billing (RF-PAG, RN-07–11):** price is 6990 BRL cents/month; first failed payment immediately removes benefits and is visible to the seller. Retry schedule is D+0/1/3. Server selects Price ID, verifies raw webhook signatures, durably records event before acknowledgement, deduplicates, handles out-of-order events, updates entitlement and enqueues notifications transactionally. Reconcile missed events. Monthly billing follows the provider's calendar anchor rather than adding 30 days.
- **Counter (RF-PP, RN-12–20):** authenticated online partner validates static card or performs exact CPF lookup plus photo confirmation, sees only minimum name/photo/status, confirms identity, inputs gross amount, reviews server totals, commits using bound validation receipt and idempotency key. Validate employee code against the admin-managed active list once at work-session start and bind employee/establishment to server-side work-session context. Recheck partner, employee and member active state at commit without asking for the code on every sale. Provide “Trocar funcionário” to validate a different code; end context on logout/account switch/expiry, preserving historical attribution. Two taps or retries create one record.
- **Verification and sessions:** Supabase Auth owns identity, verification and sessions; Meta's official API is the selected WhatsApp transport (migration pending; D26). First registration requires both email OTP and phone OTP; phone delivery uses WhatsApp; SMS fallback is removed (D26). Later logins require either email OTP or phone OTP, not both. Resend delivers email OTP and transactional emails. Present exactly “Login com whatsapp” and “Login com email” as the two member login options; SMS is not an available delivery option (D26). Keep verified email and phone on the same Auth identity/member; do not create duplicate member accounts when changing channels. Gate enrollment completion/checkout on both server-verified contact claims, not UI flags or a session created by the first OTP. Attach and verify the second contact on the same authenticated identity with duplicate-contact checks; never auto-merge unrelated accounts. Subsequent sign-in accepts either verified contact. Use throttling, resend cooldowns, bounded attempts and redacted logs. Delivery failures must show retry/help without bypassing phone verification; resends stay on the selected WhatsApp or email channel. Reconcile the provider/Supabase challenge lifecycle so resends cannot bypass expiry or attempt limits. Local tests do not send real messages. Persist member sessions with automatic refresh and rotating refresh tokens, no imposed lifetime/idle expiry; access JWTs still expire normally. Logout/revocation/storage clearing can end sessions. Staff policies remain distinct. Number/email recovery needs a reviewed support process; no member PIN.
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
| 3 — Enrollment and billing | Photo/consent/email + Meta WhatsApp verification (D26), checkout, lifecycle webhooks/reconciliation, local provider fakes (RF-CAD/PAG, source PIN requirements removed) | Sandbox enrollment activates only from verified payment; failed/duplicate/out-of-order events and cancellation boundaries tested. |
| 4 — Card and partner operation | Approved static QR/offline contract, live entitlement, camera/CPF-photo fallback, atomic discount/reversal/history (RF-QR/PP) | Member cold-launch offline passes; revoked card rejected by online partner; concurrent duplicate submissions yield one sale; OTP abuse/reversal boundaries pass. |
| 5 — Administration and communications | Partner/member management, KPIs/CSV, audited collections/support, outbox/delivery/alerts (RF-ADM/DG/NOT/SUP) | Fixture KPI reconciliation; viewer denied exports; failure/retry/fallback and opt-out scenarios pass. |
| 6 — Public launch and hardening | Real content, SEO/OG, performance, real-phone QA, provider staging, privacy/ops documentation (RF-LP, RNF) | Full acceptance matrix green, legal/content approval, backup restoration and rollback exercised in staging, monitoring configured, launch date agreed. |

**User priority: scan QR → register purchase.** After the secure shell/authorization foundation, implement phase 4 against synthetic paid-member fixtures before phase 3 provider integration. Prove static QR resolution, current eligibility, photo confirmation, server-calculated discount and idempotent purchase recording first. Then connect enrollment, billing, notifications and member reporting. Mock fixtures never establish real paid entitlement. Lower-priority analytics, ranking (RP-PP-12), onboarding campaigns and extended charts can be deferred by explicit scope decision. Do not ship with incomplete ALTA requirements merely because the source schedule placed them later.

## Verification matrix

- Unit: CPF/age date boundaries, OTP attempt/expiry rules, BRL rounding, discount ranges, entitlement/grace/cancellation/manual-block precedence, report calculations.
- Database: default-deny grants and RLS; role/tenant isolation; private photo policies; non-forgeable validation receipts; concurrency, idempotency, one reversal and append-only audits.
- Authentication: first OTP alone cannot complete enrollment or open checkout; verified email + verified phone can. Both labeled login options resolve to the same member through the chosen channel alone; Phone delivery uses WhatsApp only; SMS requests must be rejected. Test WhatsApp delivery failure/resend, removed SMS channel rejection, replay, expiry, duplicate contacts, account-linking abuse and revoked refresh tokens.
- Integration: invalid/replayed/out-of-order Stripe signatures/events; payment recovery and reconciliation; durable outbox failure recovery; retry limits and duplicate notification suppression.
- Privacy/operation: exact CPF search succeeds for authorized staff but full CPF never appears in response payloads, hydrated data, exports, logs or local caches; revoked/cross-partner employee codes cannot commit sales; work-session reuse requires no repeated code entry, operator switching changes only future attribution, and logout clears the employee context; reversals older than 96h succeed for authorized admins/support; collections commands reject viewers and duplicate requests.
- E2E: enrollment/payment sandbox, installed cold-launch offline, refresh/reconnect, expired tokens, storage eviction, logout then another account, server block while member offline, staff offline denial, camera refusal/approved no-phone fallback, admin session expiry, viewer denial.
- Performance: source API p95 <=500ms and scan-to-result <=2s against a documented representative environment; 50 simultaneous transactions; enrollment <5min and partner flow <90s in observed usability tests.
- Operations: fresh clone + local start/reset/test, separate staging/prod configuration, migration rollback/forward recovery, DB **and storage object** backup/restore, redacted logs, coarse public health and internal alerts. Database backups alone do not restore uploaded image bytes.

## Hosting and legal fixtures

Production runbook documented in [docs/producao.md](docs/producao.md): service contracting, implementation prerequisites, staging, live configuration, launch acceptance and the final customer journey. Documentation only; production integrations, deployment and live acceptance remain outstanding.

User manages frontend deployment. The frontend is now at the repository root: one package/lockfile, `src/`, `public/`, Vite config and `vercel.json` (`npm run build` → `dist`). The standalone prototype package/config was retired. Local `npm run dev` preserves the demonstration; `npm run dev:sandbox` uses port 5174 and real Supabase Auth preparation. Sandbox builds output `dist-sandbox`, omit demo modules and do not register the demonstration service worker. No deployment was performed. See [development guide](docs/desenvolvimento.md).

`docs/legal-mocks/` includes terms, privacy, photo notice and notification templates. Every mock legal page and notification template must visibly include: **Esse texto deve ser modificado por ter sido inteiramente gerado por IA e serve apenas para testes.** The transactional access-code email is exempt and uses branded HTML without the notice (D31). Mock consent versions are never accepted as real production consent.

## Historical local bootstrap milestones

Frontend promotion: the root application preserves the existing CSS/interface. Common landing/login components are shared; demo fixtures/sessions/workflows are lazy-loaded exclusively from `src/mocks/`. Sandbox has public config validation, a Supabase client with isolated refresh-based sessions, an OTP adapter and a fail-closed Checkout contract. Server-only Stripe sandbox and disabled-by-default allowlisted Twilio WhatsApp sandbox adapters are prepared, with no deployed Edge endpoints, no real messages or remote payment operations. This paragraph records the earlier Auth-only milestone; D19 is now confirmed and domain access implemented below.

Promotion verification (2026-10-19): application/provider typecheck, 27 automated tests, both builds, demonstration E2E, 320–768px layouts, sandbox isolation/OTP rejection and built-PWA offline card/savings reload passed. Original CSS bytes were preserved; sandbox output contains no demo fixtures/session keys or demo service worker. Real provider delivery and physical-phone acceptance remain outstanding.

Stripe test tooling (RF-PAG) implemented separately from the application: pinned SDK/CLI, test-only account/config guards, synthetic recurring catalog/Checkout and standalone draft invoice commands, plus a loopback webhook receiver with signed raw-body verification and deduplicated minimal receipts. Thirteen offline tests passed on 2026-10-19, including HTTP verification outside the agent sandbox. See [docs/stripe-testes.md](docs/stripe-testes.md). The operator explicitly deferred sandbox credentials and remote execution; no Stripe account objects were created. This does not implement application billing, member activation, production webhook persistence or retries. The MCP planner remains unavailable; official Stripe skills were installed through the requested fallback.

Verified 2026-10-19: Docker is accessible outside the agent sandbox; the local `rkmed` Supabase stack starts successfully with CLI 2.119.0. Local migration/seed recreation (`npm run db:reset`), SQL lint and all seven bootstrap pgTAP checks passed. Ignored root `.env.local` contains local public frontend configuration. At this earlier bootstrap milestone only Auth preparation was present; current connected implementation is recorded below. The ordered development checklist is tracked in [docs/producao.md](docs/producao.md#4-implementar-o-backend-e-conectar-as-telas).

Mobile frontend refinement is implemented in the prototype: QR-first phone layout, labeled staff navigation drawer, compact partner results, larger touch targets and viewport-bounded dialogs. Responsive checks pass from 320–768px; see `docs/DESIGN_AUDIT.md`. Physical Android/iPhone verification remains outstanding.

See `README.md` for executable commands and current verification results. The initial migration intentionally creates only a private bootstrap marker and pgTAP smoke tests, not a prematurely finalized billing schema. `src/mocks/` preserves the demonstration frontend flows with fictional local data, including live camera face detection during enrollment, still-photo validation, QR scanning, purchase/savings, and staff views. Its authentication and payment actions are simulations; Supabase-backed enforcement is now implemented separately in sandbox mode. Business fixtures and role tests belong to phases 2–4. Camera operation still needs real Android and iPhone verification over HTTPS.

Production deployment, live payments/messages and remote Supabase projects are outside this bootstrap. Secrets are supplied through ignored environment files/secret stores. No user password is required in chat.

## Technical references checked during planning

- [Supabase local development](https://supabase.com/docs/guides/local-development): project-local CLI and Docker stack.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) and [MFA](https://supabase.com/docs/guides/auth/auth-mfa): database authorization and assurance enforcement.
- [shadcn/ui with Vite](https://ui.shadcn.com/docs/installation/vite): React/Vite setup.
- [Stripe webhooks](https://docs.stripe.com/webhooks) and [subscription events](https://docs.stripe.com/billing/subscriptions/webhooks): signature verification and real event contracts. Relevant candidates include `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, and `customer.subscription.deleted`; verify chosen API version and event payloads during implementation.

These references correct technical integration contracts, not unresolved business or legal policies. Prices, retention duties and legal deadlines are deliberately not asserted from the draft.

- [Supabase Send SMS Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook) and [phone authentication](https://supabase.com/docs/guides/auth/phone-login): support the WhatsApp OTP integration decision; Z-API has been removed by the user. Validate hook signature, provider outage behavior and plan availability before implementation.

- [Supabase sessions](https://supabase.com/docs/guides/auth/sessions): persistent refresh-based sessions with short-lived access tokens. [Phone sign-in](https://supabase.com/docs/guides/auth/phone-login) supports WhatsApp through Twilio/Twilio Verify; email transport remains a separate choice.

## Implementation choices delegated on 2026-10-19

User confirmed D19 and the proposed discount/rounding/cancellation rules; the answer “Faça o que você achar melhor” delegated remaining MVP implementation choices. Support can manage partner/employee/member operations, reverse records and collect existing invoices but cannot provision staff/roles. Viewer sees name, masked CPF, membership status/dates and savings only; no contact details, photos, mutation or exports. Admin alone provisions staff. Use versioned clickwrap, 600×600 sanitized JPEG, staff 8h/30min sessions and no persistent sensitive enrollment drafts. Transactional notices go to the affected member and operational failures to the internal queue; no marketing automation. Provider credentials and real-device/provider acceptance remain external dependencies. These are implementation decisions for test readiness, not approval of mock legal text for production.


## Connected implementation — 2026-10-19

Supabase local now has private domain tables, explicit RLS/grants, verified-session RPCs, scoped photos, server employee sessions, short-lived validation receipts, integer-cent quotes, atomic/idempotent purchases, linked reversals, admin blocks, partner/employee controls and viewer-safe projections. Synthetic seed covers paid/blocked members, two establishments, staff roles and pending enrollment. Shared shell keeps original styling; sandbox panels use real local Auth/RPC/Storage.

Enrollment links email/phone verification on the same Auth identity, records versioned consent and remains incomplete without payment. The Edge photo path validates a 600px JPEG and a single face with a bundled local model, then strips metadata. Sandbox Stripe endpoints enforce test-account/catalog binding, one pending Checkout, customer/invoice ownership, operator confirmations, signed durable event receipts and leased current-state reconciliation. Risk events queue review. Auth hooks verify Standard Webhooks; channel intents, provider recipient allowlists and rate limits are server-owned. Outbox jobs use leases/backoff and Resend idempotency; provider acceptance is not delivery confirmation. Billing retry timing still requires sandbox Dashboard configuration/acceptance.

The member PWA uses static-only precache and an explicit account-scoped snapshot. Offline status is historical, actions are disabled, and no operational commands are queued. Offline lifecycle acceptance is tracked in the test results/runbook; real-phone HTTPS acceptance remains required.

Earlier bootstrap/promotion paragraphs are historical milestones, not the current implementation limit. Full MVP acceptance is still open: external credentials/provider journeys, hosted realtime acceptance, load/performance, recovery/monitoring and legal/device acceptance. Do not report the system as 100% homologated or production-ready. No external payment, message, deployment, project provisioning or credential publication was performed.


## Local verification — 2026-10-20

Application/Edge typecheck, demo/sandbox builds, 33 automated tests, SQL lint and 66 pgTAP assertions passed. Connected browser journeys cover public versioned legal documents, private member photo, counter quote/purchase, viewer restrictions and member card. Enrollment/Edge tests passed against the real Docker runtime. Transport failure is distinguished from HTTP authorization refusal before opening the account-scoped offline snapshot; logout/account isolation passed. Enrollment now exposes resend/SMS fallback with cooldown. External messaging/payment acceptance and the remaining items in `docs/homologacao.md` are still open. No production publication.


## Reports and export verification — 2026-10-21

RF-ADM/DG reports are implemented with server-side aggregates, Recife period boundaries (maximum 366 days), optional partner filter and reversal reconciliation. Aggregates retain exact cents as strings. Admin/support can export up to 5,000 rows with masked CPF, no contacts/photos/QR, durable audit and five-per-minute actor rate limit. Viewer export is rejected by the database. CSV neutralizes formula-like prefixes and preserves quoted boundaries. Reports explicitly describe purchase totals rather than subscription revenue.

Verification completed: 35 automated tests, 92 pgTAP assertions, typecheck and sandbox build passed; SQL lint passed for the report migration in the preceding round. The connected mobile report test passed for viewer denial in UI/API and authorized CSV download. The prior test failure was corrected by changing the historical date fixture and rerunning SQL successfully. Removed the general no-op refresh button on the reports tab; use the explicit report query action. Remaining production work includes hosted load/performance, recovery/monitoring, provider sandbox acceptance and legal/physical-device approval. No deployment or external delivery was performed.


## Operational realtime alerts — 2026-10-21

RF-ADM/DG/NOT implemented locally: private outbox, webhook and subscription changes invalidate a single public signal row (id/revision/timestamp only). Only that minimal table is added to `supabase_realtime`. RLS checks server-owned admin/support roles, actual Auth session, 8h maximum and 30min inactivity for each read/event; summary reads do not update staff activity. The protected summary contains counts only. Viewer/member/partner/anonymous cannot receive signals or query totals. No browser writes are granted on the signal.

The internal panel refreshes on signal, subscription/reconnection and visibility return, coalesces bursts and falls back to a 30s visible-page query. Errors clear counters; offline controls are disabled. Manual navigation to collections reloads details even when that tab is already open. Risk counts represent recorded signals and remain after email acceptance; this feature does not implement structured risk closure or change billing eligibility. Charts/reports remain refreshed on demand.

Validation: 36 automated tests, 124 pgTAP assertions, SQL lint, application/Edge typecheck and sandbox build passed. Real local Realtime/WebSocket plus mobile browser verified update without manual refresh, minimal payload, role isolation and revocation during an existing subscription. Provider delivery, hosted realtime limits/reliability, hosted load/performance, recovery/monitoring and physical-device/legal approval remain pending. No deployment or external messages/payments.


## Bounded pagination and local performance — 2026-10-21

RF-ADM/DG/PP/QR implemented: cursor pages by (created_at,id), default 25/max 100, literal server-side name search, past-due filter and supporting indexes. Member/partner scopes are selected from verified server roles before limiting rows. Member directory savings and own-member balance aggregate all valid purchases independently of page size and retain exact cents. Legacy RPCs are bounded at 100 and removed from browser adapters; current UI never calls them. Administration no longer loads all purchases to compute each member's savings or unrelated lists on every tab.

The member snapshot merges visited history pages without deleting older saved records, persists the full balance separately and supports local offline paging with an incompleteness notice. Prior snapshots remain readable. Account changes remount the connected panels; stale responses cannot replace a newer search. No payment/operational action is queued offline.

Validation: 37 automated tests, 155 pgTAP assertions, lint/typecheck/sandbox build, connected mobile counter/pagination and offline behavior passed. Local HTTP benchmark: 2,000 generated members, 10,060 purchases, 200 paginated reads at concurrency 10 and 50 distinct simultaneous commits across two partner sessions. p95 pages=117.15ms, lookup=127.82ms, quote=90.58ms, commit=173.25ms. Generated fixtures were removed without resetting seed data; no provider calls. See `docs/desempenho.md` and machine-readable `docs/performance-local.json` for methodology, environment and limitations. Hosted latency, cold starts, provider behavior and representative production SLA remain unverified.

## Hosted Stripe Checkout configuration — 2026-11-04

RF-PAG: both existing Checkout Session creation calls now use the requested Checkout Studio settings, retaining the recurring BRL price and existing return URLs. During the requested continuation, the connected adapter's `customer` parameter was restored as an exception to the original removal rule so Checkout and provider reconciliation use the member's persisted Customer. No new endpoint, dependency or database structure was added. Regression coverage exercises Checkout creation followed by provider-event reconciliation for the same member; session creation alone grants no entitlement.

Validation: application/Edge typecheck, sandbox build and all 38 Node tests passed, including the local HTTP webhook test (with localhost permission). The local Stripe doctor reports no configured test key, account or webhook secret for the independent tooling; real sandbox Checkout and PWA acceptance remain pending. No remote payment or deployment was performed. [STRIPE_INTEGRATION_TODO.md](STRIPE_INTEGRATION_TODO.md) is the source of truth for remaining Stripe setup and acceptance steps.

## Camera and photo WebGL recovery — 2026-11-04

RF-CAD: reproduced the exact `Cannot read properties of undefined (reading 'activeTexture')` failure by denying browser WebGL contexts. MediaPipe's CPU delegate still used a graphics upload path. Photo and live detection now fall back to the existing local BlazeFace model using TensorFlow.js CPU pixels when WebGL is unavailable or its processing fails. Face confidence, size and single-face checks remain enforced; no photo is accepted merely because an engine failed. MediaPipe loaders/WASM now come from the installed package through versioned build assets instead of mismatched copies in `public/wasm`. Live analysis awaits each inference and stops camera tracks on terminal failure.

Validation: typecheck, demo/sandbox builds and 38 Node tests passed. Browser regression covers photo/live-frame detection and no-face rejection with and without WebGL. Full simulated camera → capture → photo validation passed without WebGL in development, and with/without WebGL against the compiled demo. These are browser tests with a synthetic camera stream, not physical Android/iPhone acceptance. No deployment performed.

## WhatsApp-only phone delivery — 2026-11-04

D26 follow-up implemented: SMS removed from enrollment/login copy, controls, channel contract, runtime adapter, gateway and delivery transport. Resends retain WhatsApp or email; phone verification remains required alongside email during enrollment. The signed phone hook refuses any claimed channel other than WhatsApp. A new migration restricts private intents and the service-only preparation function to WhatsApp, discards obsolete pending SMS intents and preserves cooldown/single-use claim protections. Original migrations are unchanged. Supabase phone-OTP protocol names containing `sms` remain where required; they do not enable SMS delivery.

Verification: 39 Node tests, 158 pgTAP assertions, SQL lint, application/Edge typecheck, demo/sandbox builds and browser flows passed. Direct Edge HTTP test rejects the removed SMS channel before provider calls. Migration applied only to local Docker; no external message or deployment. The legacy WhatsApp transport still awaits the separate Meta migration defined above.

## Wedea Connect revenue share — 2026-11-08

RF-PAG / D27 implemented: paid membership invoice reconciliation atomically snapshots the active-benefit member count and reserves a fixed 1587-cent share above 200. Initial payments and renewals use the same flow; zero-value invoices earn no share. A service-only RLS ledger preserves skipped/earned decisions across retries and later count changes. Connect separate transfers validate recipient capability, freeze destination/payment parameters, and use per-invoice idempotency plus worker leases. Uncertain attempts older than 23h stop for reconciliation. Provider jobs retry pending ledger entries independently of webhook retry limits. Refunds/disputes retain the existing risk review flow and never reverse Wedea transfers.

Verified locally: application/Edge typecheck, sandbox build, SQL lint and 192 pgTAP assertions passed. The full Node suite passed 46 tests; a subsequently added paid-renewal/configuration-failure regression passed with all eight Wedea tests. Real concurrent PostgreSQL connections confirmed exactly one worker reserves the same transfer. Migration applied only to local Docker. No external Stripe payment, account onboarding or deployment performed. Configure `STRIPE_WEDEA_ACCOUNT_ID` and complete sandbox Connect acceptance per [docs/wedea-connect.md](docs/wedea-connect.md).

## Mobile member PWA installation invitation — 2026-11-08

Added a mobile-only installation dialog in the connected member area and the isolated member demonstration. A root provider captures `beforeinstallprompt` before lazy member screens load; browsers exposing it get an install button. iPhone/iPad users get Safari Add to Home Screen instructions, and other browsers get menu instructions when no native prompt is available. The dialog is hidden in standalone/fullscreen app mode, on desktop and in public/staff areas. “Agora não”, close and Escape snooze it for seven days on that browser; blocked local storage still allows dismissal for the mounted visit. Native dialog focus management and a scroll lock keep the modal usable on narrow screens. No membership, billing or offline-eligibility rules changed.

Validation: application/Edge typecheck and demo/sandbox builds passed. `node tests/pwa-install.mjs` passed browser checks for 360px iPhone instructions, native install invocation/error fallback, persistence after dismissal, installed-app detection, desktop/public/staff exclusion and capture before entering the member area. Browser events and iPhone identity were emulated; real-device PWA installation acceptance over HTTPS remains pending. No deployment performed.

## Interface — 2026-11-08

A pedido do usuário, removidas as indicações gerais de protótipo/demonstração da faixa superior, rodapé, cartão, rede de parceiros, acessos e cadastro. Mantidos os avisos específicos de operações simuladas e documentos jurídicos de teste; a alteração é de apresentação e não muda o modo de execução nem a integração dos provedores.

## Hosted Supabase testing deployment — 2026-11-08

Explicit user authorization: deployed the 12 existing migrations to project `chuyompxoctmpawhfmyb`, aligned hosted migration versions with source files, set domain environment to sandbox, and loaded the three current test-only legal documents. Deployed six authenticated/signed handlers alongside the five legacy functions; new billing events use `rkmed-stripe-webhook` to preserve the existing endpoint. Kept legacy data, bucket, functions and cron. No Docker seed, fixed OTP, paid-member fixture or external message/payment was copied/executed.

User supplied `https://rk-med-proto.vercel.app` as the HTTPS test origin and authorized the verified existing `jak_singer@hotmail.com` account as the first administrator. Server routing is fixed to that sandbox origin; role bootstrap is audited. Function packages contain public routing only, with provider secrets remaining server-side. The main API needed explicit TensorFlow core/CPU imports instead of the full package to bundle successfully; the same face-validation checks pass. `scripts/dev/package-functions.mjs` reproduces the text-only MCP packages and unchanged embedded model assets.

Verified: hosted migrations, 23 private tables with RLS/no browser SELECT, service-only grants, private JPEG bucket and minimal Realtime publication; rolled-back hosted admin authorization query; 12 HTTPS public/denied/CORS checks; local typecheck, sandbox build and 47 Node tests after the import fix. The earlier preparation passed 192 local SQL checks. Hosted frontend publication/configuration, Auth hooks/settings, Stripe/Resend/Meta credentials and delivery, worker scheduling, full payment/device acceptance and legacy advisory remediation remain outstanding. See [hosted testing deployment](docs/supabase-testing.md) for exact endpoints, checks and next steps.

## D28 — SMS OTP replaces WhatsApp

Latest explicit user decision: remove WhatsApp and use SMS for phone OTP. Email remains an independent login option and mandatory at first enrollment alongside SMS. Native Supabase Auth SMS delivery replaces the WhatsApp hook; configure its provider and disable the legacy Send SMS hook. Gateway remains disabled until SMS_MODE and recipient allowlist are configured. The new sms_only_delivery migration supersedes D26 without modifying applied migrations. External SMS receipt and frontend publication require separate verification.

SMS rollout verification: migration 20261108203455 applied locally and to the hosted testing project; canonical migration version aligned. phone-code and auth-sms deployed as version 3. The legacy hook now refuses delivery and must be disabled in Auth when configuring the native SMS provider. Local 47 Node tests, 192 SQL assertions, typecheck and sandbox build passed. Frontend publication and real SMS delivery remain pending; no external message sent.

## Environment consolidation — 2026-11-08

At the user's request, consolidated repository-owned dotenv files into root `.env.test` and `.env.prod`, both ignored by Git with permissions 0600. Existing local/provider values were preserved; conflicting archived prototype configuration was retained under unused `LEGACY_*` fields. Production defaults contain no copied test credentials. Removed the previous root, functions and prototype dotenv/example files. `env:init` recreates only these two files from versioned defaults without overwriting existing configuration.

Vite explicitly reads the selected file and exposes only `VITE_*`, with automatic dotenv loading disabled. Demo and connected test commands share `.env.test`; `functions:serve`, Stripe utilities and local preparation use the same file. The independent Stripe listener can use `STRIPE_CLI_WEBHOOK_SECRET`. `build:prod` selects `.env.prod` and still fails closed on the pre-existing production environment guard; this change does not enable live integrations or deploy anything. See [environment setup](docs/ambientes.md).

Verified: application/Edge typecheck, demo and connected test builds, 25 configuration/adapter/Stripe tests, initialization idempotency and Stripe offline diagnosis passed. Scanned both browser bundles against configured private values: none exposed; the connected build excludes the demo module. Confirmed only the two requested dotenv files remain outside dependencies, both ignored and restricted to 0600. Production build refusal was verified separately as expected. No database, hosted secrets or deployment changed.

## Environment architecture audit — 2026-11-08

Reviewed the actual frontend, Edge handlers, session bridge, OTP engine, message transports, Stripe runtime and local tooling. Current architecture: React/Vite PWA; Supabase PostgreSQL/RPC/RLS, private Storage, Edge Functions and managed sessions; RKMED-owned OTP; SMS Dev and Resend delivery; Stripe Billing/Connect and operational jobs. Removed nine obsolete fields from `.env.test` and eleven from `.env.prod`: Twilio settings, retired native OTP hook secrets, unused `SMS_MODE`, archived prototype key, and (production only) the three standalone Stripe sandbox-tool settings. Updated initializer defaults so new files do not restore those fields. Preserved all retained values and runtime-required sandbox checks/allowlists; no database or hosted configuration changed.

Verified application/Edge typecheck, connected build, four existing environment tests and offline Stripe diagnosis. Audited active environment references against the test defaults: every consumed field is represented except the three Supabase credentials supplied by the runtime. Both files match their intended defaults (28 test fields; 25 production fields). Production remains disabled. [Environment guide](docs/ambientes.md) now records the architecture and rationale for retained/removed fields.

## D29 — Independent OTP engine and SMS Dev delivery

User selected SMS Dev and required all code/OTP logic to be independent of Supabase delivery providers. RKMED generates unbiased cryptographic six-digit codes, stores challenge-scoped HMACs only, enforces five-minute expiry, 60s resend cooldown, five requests/hour/contact, five attempts/challenge and ten attempts/hour/contact, and atomically consumes each code once. Both email signup/login and SMS login/phone attachment use this engine. Resend transports email; SMS Dev transports SMS via JSON POST type 9, with refer as correlation only and accepted provider ID stored privately. Unknown logins do not send a usable challenge. Staff retain their password flow.

Supabase remains the managed identity/session store: after RKMED validates a code, a separate server-side adapter generates/redeems an internal magic link for that same user. This internal session token never reaches the user and is not the OTP typed by the member. Phone ownership is marked by the trusted backend only after challenge validation. Existing native email/SMS delivery hooks reject use. Native Auth provider settings must also be reviewed to prevent alternate public OTP entry paths. No secret is embedded in the frontend.

D29 verification: hosted migration 20261108204032 applied with RLS and service-only RPCs. phone-code deployed with SMS Dev; native auth-sms/auth-email handlers now refuse member OTP delivery. Local typecheck, sandbox build, 58 Node tests and 214 pgTAP assertions passed; real local code-to-managed-session exchange and browser rejection tests passed. Hosted rolled-back SQL confirmed one-time consumption and denied browser reads; HTTPS endpoints fail closed without OTP configuration. New OTP objects have no security warnings beyond the intentional no-policy deny-all information. No actual SMS/email, provider purchase or frontend deployment was performed. Credentials and receipt acceptance remain pending. See docs/smsdev-otp.md.

## Support, overview and connected member sections — 2026-11-08

Implemented the previously missing connected screens. Migration `20261108210000_support_overview.sql` adds private support requests with RLS and authenticated RPCs: members open messages, admin/support list and answer them, viewers are denied, and opening is limited to five per actor per hour. The member projection (`rk_context`) now returns the own verified e-mail and a masked phone; `rk_member_economy` returns the member's exact savings totals, purchase count and distinct partners; `rk_admin_overview` returns aggregate KPIs plus recent purchases and past-due members for admin/support/viewer.

The connected member area now has four routed sections: **Início** (card/QR), **Parceiros** (directory and map), **Economia** (totals and paginated history) and **Conta** (verified contacts, subscription management and support form). The administration default route `/admin` opens **Visão geral**; **Associados** moved to `/admin/associados`, and **Suporte** was added for admin/support. The viewer role can read aggregate overview data but cannot read or answer support messages, including in direct RPC calls.

Verified locally: 58 Node tests, 235 pgTAP assertions across nine files, typecheck, sandbox build, connected UI test with real local Auth/RPC/Storage, demo E2E and mobile layout tests. `npm run db:reset` applied all 15 migrations and the support SQL test rolls back cleanly. The new migration has not yet been applied to the hosted testing project; no real Stripe payment, SMS/email delivery, hosted deployment or production enablement was performed.


## D31 — ClickSend e homologação conectada — 2026-11-09

Decisão explícita do usuário: ClickSend substitui SMS Dev como transporte de SMS. A RKMED continua emitindo/verificando OTPs de SMS e e-mail; Supabase gerencia a sessão. `CLICKSEND_MODE`, `CLICKSEND_USERNAME` e `CLICKSEND_API_KEY` são privados. A allowlist, expiração, limites e vínculo à mesma identidade permanecem. SMS Dev fica somente como código legado sem referência no gateway ativo.

Implementado/publicado: build conectado como padrão; demonstração somente por comando explícito; `build:hosted` força sandbox HTTPS e é usado pela Vercel. Publicação `dpl_FP6woehta7pYaFYpKL5hcmxcdE1J` em https://rk-med-proto.vercel.app com o projeto `chuyompxoctmpawhfmyb`. Segredos privados nunca entram no frontend. Telas vazias consultam banco real, sem fixtures. Aviso de atualização da PWA e erro explícito da rede de parceiros adicionados.

Banco: suporte/visão geral existiam sem registro de migration. As seis funções e estrutura completa (colunas, constraints, índices, RLS e bloqueio de leitura) foram comparadas com o local, com igualdade exata; histórico de `20261108210000` reconciliado. Aplicadas `20261108220000` e `20261108223000`, sem seeds/reset. Total hospedado: 17 migrations. Seis Edge Functions publicadas, incluindo ClickSend e gestão da assinatura.

Integrações: conta/preço Stripe de teste conferidos (BRL 6990/mês). Criado webhook `we_1UZwSN6KdnsqbUqNGYdY1M5V` com dez eventos; segredo configurado apenas no servidor. Worker `rkmed-provider-jobs` agendado a cada cinco minutos, bearer no Vault; cron legado preservado. Worker HTTP 200 sem falhas e evento assinado sem efeito financeiro HTTP 200. ClickSend autenticou em consulta à conta; ainda falta comprovar SMS no aparelho. OTP e-mail solicitado no backend hospedado retornou HTTP 200/desafio emitido; usuário confirmou recebimento de e-mails de teste. O HTTP 401 `restricted_api_key` na consulta de domínios Resend indica permissão somente de envio, não chave inválida.

Verificado: typecheck, 63 testes Node, lint SQL, 235 verificações pgTAP, builds hospedado/local, API/OTP/cadastro/foto/Edge/UI/offline locais e smoke HTTPS hospedado. Teste SQL de economia passou a comparar compras persistidas e estornos, sem supor banco local vazio. Nenhuma cobrança foi efetuada; cadastro completo/pagamento hospedado e aparelhos físicos ainda dependem de aceite. O banco hospedado continua sem associados/parceiros/assinaturas; não foram copiadas fixtures. Produção comercial continua bloqueada. Situação e pendências em docs/prontidao-producao.md.


## D32 — Contatos abertos na homologação — 2026-11-09

Usuário autorizou explicitamente qualquer celular/e-mail para cadastro e testes. Gateway e adaptadores ClickSend/Resend aceitam `*` explícito nas listas de contatos; listas vazias continuam recusando. `.env.test` e segredos hospedados usam `*`; defaults novos permanecem fechados. Continuam válidos contatos brasileiros, limites de OTP, finalidade/vínculo da identidade, consumo único e recusa de produção/live. Incluído teste de wildcard com validação de canal e guardas de produção. Isso não autoriza converter contas internas em associados.


Verificação D32: `phone-code` v11 e `provider-jobs` v8 publicados; ambos os canais aceitaram contatos fora da antiga lista via desafios de login sem identidade, sem envio utilizável/criação de conta. Suíte final: 64 testes Node aprovados. Um SMS de teste de integração (sem código de acesso) para o celular anteriormente configurado foi aceito pelo ClickSend com HTTP 200/SUCCESS, ID `1F1DC656-C54E-6E98-A242-83AD82EB9C00`; entrega física ainda não presumida. OTP e-mail hospedado aceito e usuário confirmou e-mails de teste. Cron executou com status succeeded e worker direto respondeu sem falhas.

PWA: `node tests/pwa-update.mjs` passou com service worker real, aviso de nova versão e recarga após confirmação. Scan final de código/documentação/testes sem credenciais privadas configuradas; `git diff --check` aprovado. Recibo imediato ClickSend retornou NOT_FOUND (ainda não é prova de entrega física).

**Aceite do usuário — 09/11/2026:** SMS de teste recebido no aparelho. Entrega real ClickSend validada. Isso não substitui a conclusão do cadastro integrado e o aceite do ciclo Stripe hospedado.


## D33 — Entrada por código do estabelecimento — 2026-11-09

Solicitação explícita do usuário: funcionário informa código de estabelecimento em vez de escolher uma unidade livremente. Implementado no início de turno conectado e na demonstração: código do estabelecimento + código do funcionário, sem seletor. Conta compartilhada e sessão autenticada do parceiro permanecem obrigatórias no fluxo real; um código de outro estabelecimento nunca muda o vínculo autorizado.

Migration `20261109180612_establishment_entry_code`: código alfanumérico único de dez caracteres, gerado pelo banco para parceiros existentes/novos; RPC de início exige os dois códigos e mantém limites/auditoria. Assinatura antiga sem estabelecimento removida. O código identifica a unidade e não substitui senha nem autorização. Diretório público e diretoria não recebem o código; administração/suporte consultam em Parceiros. Troca de funcionário encerra o turno e exige os dois códigos novamente. Compras históricas preservam atribuição.

Verificado localmente: typecheck, builds conectado/demo, 65 testes Node, 253 verificações pgTAP e lint SQL aprovados. Testes HTTP reais de compra/estorno e navegador conectado passaram. Demonstração validou criação de parceiro/funcionário, recusa de par incorreto, ausência de seleção e histórico restrito. Helper local passou a encerrar apenas sua própria sessão de suporte para não desconectar outras fixtures. Migration aplicada ao Supabase hospedado sem seeds/reset; total de 18 migrations. Publicação Vercel `dpl_3AdouKnkkE3mfoVHPT6VMQicMc28` confirmada READY no domínio estável.

Verificação hospedada D33: smoke HTTPS aprovado, início de turno negado sem sessão e geração automática/ausência de código no diretório público confirmadas em transação revertida. Nenhum parceiro sintético permaneceu no banco remoto.


## D34 — Mapas interativos nas visões de parceiros — 2026-11-09

Solicitação explícita do usuário: consultar os parceiros em mapa interativo dentro do sistema nas suas visões. Adicionado componente compartilhado de localização, com ação Ver no mapa em cartões/listas da landing, associado, gestão conectada/demo, atalhos demo e identificação do próprio parceiro no balcão. Os mapas abrem no local, sem navegar para fora do app; o link externo permanece opcional. A seleção da rede no mapa agregado continua disponível.

O endereço cadastrado determina a pesquisa. A chave Google Maps Embed existente é usada quando configurada; sem ela, o mapa público incorporado por endereço substitui o antigo placeholder. Verificação real do iframe confirmou carregamento e 13 controles interativos sem chave. Não há geocodificação própria, alteração no schema ou cadastro de fornecedor. Nenhuma credencial ou código de estabelecimento/funcionário é enviado ao mapa.

Mapas individuais carregam somente ao expandir, são desmontados ao fechar e não fazem parte do cache offline. Offline apresenta reconexão/endereço sem iframe. Endereço vazio recebe mensagem explícita. Mantidos estados de carregamento/falha, teclado, títulos por parceiro e layout de 360px.

Verificado: typecheck, 68 testes Node, builds hospedado/demo, teste de mapas em navegador nas áreas pública/admin/associado/parceiro (transporte do provedor isolado), teste conectado de balcão e teste real separado do iframe Google. Publicação Vercel `dpl_DsngysE9taxsnDcoHUFBtdCQphwN` confirmada READY no domínio estável. Banco/funções/provedores de pagamento e mensagens não foram alterados.

D34 hospedado: smoke HTTPS aprovado e iframe real conferido no domínio publicado a 360px, com mapa/ruas e 13 controles Google. O parceiro usado nessa verificação foi injetado somente na resposta do navegador, sem escrita no banco. Captura visual confirmou mapa dentro do cartão e ausência de overflow.

## D35 — Suporte completo — 2026-11-09

Solicitação explícita do usuário: completar o suporte. Respostas salvas entram atomicamente na fila de e-mail, com chave de idempotência estável, lease, tentativas e recibo privado do provedor. O worker processa suporte independentemente da disponibilidade Stripe. O associado consulta somente o próprio histórico na Conta e pode encerrar solicitações; admin/suporte filtram, respondem, encerram e recolocam falhas na fila, com limite de três ações manuais por hora/solicitação. Respostas são imutáveis e permanecem ao encerrar. Aceite pelo provedor não é apresentado como entrega física. Atendimento continua assíncrono, sem chat em tempo real.

## D36 — Gestão de acessos internos — 2026-11-09

Solicitação explícita do usuário: completar a gestão de acessos internos. Em Equipe, somente admin consulta/busca/pagina contas, cria acessos, altera perfil/vínculo/situação, redefine senha e consulta as últimas vinte ações auditadas. Alterações e senhas exigem motivo e confirmação; o backend valida papel atual, sessão gerenciada, revisão concorrente e estabelecimento. Suporte mantém a gestão de funcionários dos parceiros, sem gerir contas internas. Membros e contas pendentes ficam fora da lista.

Desativação, alteração efetiva e início da redefinição de senha invalidam sessões anteriores nas operações da aplicação por data de criação da sessão; reativar exige novo login. Isso não afirma revogação global de JWT no Auth. Não se permite alterar/redefinir a própria conta pelo painel; proteção de último administrador preservada. Senhas seguem apenas para Auth, sem persistência em auditoria ou armazenamento do navegador. Redefinição usa operação com lease e recibo para impedir repetição concorrente/concluída. Criação com falha de provisionamento remove somente a nova identidade criada pela própria operação.

Validação local: typecheck, builds sandbox/hospedado, 77 testes Node, 278 verificações pgTAP e lint SQL aprovados. Auth real local verificou criação, troca de senha, replay, senha antiga recusada, sessão anterior bloqueada e auditoria sem senha. Navegador a 360px verificou resposta, leitura pelo associado, encerramento e revisão de acesso, sem overflow. Migration 20261109185439 publicada no Supabase de homologação (19 migrations), sem seeds/reset; handlers rkmed-api, provider-jobs e phone-code publicados. Nenhuma conta ou mensagem sintética foi inserida no banco hospedado. Produção comercial permanece desabilitada.

D35/D36 hospedado: publicação Vercel `dpl_4D1utBN74paJpD2N6BgwjCiDRqwD` confirmada READY no domínio estável. Smoke HTTPS aprovado incluindo recusa de rk_staff_accounts sem sessão. Análise hospedada de segurança revisada: novos grants de RPCs authenticated são intencionais e protegidos por autorização interna; rotinas backend não são executáveis por navegadores. Avisos legados continuam pendentes de saneamento antes da produção comercial.

## D37 — Cadastro completo de parceiro de teste no site publicado — 2026-11-09

Usuário confirmou que “produção” significa o site atual de homologação, pediu cadastro completo pelo admin e escolheu ocultar o estabelecimento dos associados. Em Admin → Parceiros, ação Criar parceiro de teste reúne estabelecimento, desconto, login e primeiro funcionário. Revisão sem exibir credenciais; resultado informa e-mail, código do estabelecimento e instruções de entrada. Somente admin cria; suporte mantém a gestão operacional existente. Estabelecimento marcado no servidor com is_test, padrão false nos registros existentes; formulários comuns não alteram a marca. Diretório público/landing/mapas dos associados excluem testes. Contexto autenticado fornece o próprio estabelecimento ao parceiro, com identificação de homologação, sem depender do diretório público.

Gateway e banco recusam o fluxo em produção comercial. Finalização cria estabelecimento, funcionário e papel em transação única, com auditoria. Reserva privada com UUID de Auth, operação, lease e código de funcionário apenas em hash torna a criação recuperável. Senha vai somente ao Auth, sem persistência na reserva ou auditoria. Metadado de aplicação identifica exclusivamente a operação de provisionamento, nunca autoriza papéis. E-mail ocupado não adota nem altera conta existente. Resposta incerta do Auth é reconciliada pelo UUID reservado. Identidades de uma operação incompleta são rastreadas e impedidas de operar/cadastrar associado até a retomada, em vez de serem excluídas após uma resposta incerta. Retentativas preservam a identidade, evitam duplicação e retornam o resultado já concluído. Sem Stripe, SMS ou envio de senha/e-mail no cadastro.

Verificação local: typecheck, builds sandbox/hospedado, 83 testes Node, 297 verificações pgTAP e lint SQL sem erros. Auth/Postgres reais comprovaram concorrência/replay, bloqueio de conta pendente e recuperação após falha de finalização, login, dois códigos, diretório oculto e suporte negado. Navegador a 360px executou formulário, revisão/volta, cadastro completo via Edge real e login/turno do parceiro oculto, sem overflow nem senha no localStorage. Registros sintéticos removidos somente no Docker local. Migration 20261109201327 publicada na homologação sem seeds/reset; gateway rkmed-api atualizado. Nenhum parceiro/conta sintética criado no banco hospedado; produção comercial permanece desabilitada.

D37 publicação: Vercel `dpl_J2pbGLG1qTctsJ6Xhg1LHYhy8qa6` confirmada READY no domínio estável; total hospedado de 20 migrations. RLS e grants service-only verificados por consulta remota. Análise hospedada sem novos avisos nos objetos test_partner; avisos legados mantidos na preparação comercial.

D37 smoke HTTPS aprovado após publicação: rotas públicas conectadas, recusa anônima das novas rotinas de finalização/liberação e ausência de mocks. Nenhum OTP, pagamento ou cadastro hospedado disparado.
