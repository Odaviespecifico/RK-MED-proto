# RKMED Linha Gold

Planning, local backend foundation, and an interactive React/Vite PWA prototype for RKMED.

- `agents.md`: development rules; `AGENTS.md` is its automatic-discovery entry point.
- `plan.md`: document review, architecture, confirmed decisions and implementation gates.
- `docs/discovery.md`: discovery questions and answers received so far.
- `prototype/`: frontend-only mock of landing, enrollment, card, partner counter and admin flows; see `prototype/README.md` for demo credentials and commands.
- Original requirements remain unchanged in the DOCX.

## Current state

Supabase CLI **2.119.0** is installed as a pinned development dependency with `package-lock.json`. Project initialization succeeded. Local configuration, a private-schema migration, synthetic seed and seven pgTAP checks are included.

**The stack has not started and database tests have not run.** On this host, `/var/run/docker.sock` is owned by `root:root`; user `davi` cannot access Docker and passwordless sudo is unavailable. `supabase start` confirmed the same permission error. Enable Docker access using your system's supported configuration, then run the commands below. Do not share your password or make the Docker socket world-writable.

A React PWA prototype exists in `prototype/` with local mock logic. Its staff route guards, OTPs, payment flows and collection controls are demonstrations; production admin authentication and provider integrations are not implemented yet. Those are specified in the plan. No real messages/payments are sent and no remote Supabase project is linked.

## Prerequisites

- Node.js 22+ and npm (bootstrap used Node 24.16.0 / npm 11.13.0).
- Running Docker accessible to your user: `docker info` must succeed.
- Network access for initial npm dependencies and Supabase container images.
- Free local ports 54320–54324 and 8083. Use a trusted development machine/network; local tooling includes administrative services. Review Docker port publishing before testing on a shared network.

## Start and verify

```bash
npm ci
npm run db:start
npm run db:status
# Destructive to this project's LOCAL data; use for fresh fixtures/testing.
npm run db:reset
npm run db:lint
npm run db:test
```

Expected after a successful start:

| Service | Address |
| --- | --- |
| Supabase API | http://127.0.0.1:54321 |
| Postgres | 127.0.0.1:54322 (local database/user/password: postgres) |
| Studio | http://127.0.0.1:54323 |
| Captured auth email | http://127.0.0.1:54324 |

`db:status` prints local credentials; do not paste privileged keys into chat or logs. Copy `.env.example` to `.env.local` when frontend work starts, then set only the local publishable/anon key. Server secrets never belong in `VITE_*` variables. No Supabase cloud account/login is required for the local stack.

```bash
npm run db:stop
# Print generated TypeScript database types when domain migrations exist:
npm run db:types
```

Normal stop preserves local volumes. Do not add `--no-backup` unless you intend to discard them. `db:reset` explicitly targets local data. The CLI commands are based on [Supabase local development](https://supabase.com/docs/guides/local-development).

## Local authentication fixture

Config uses the future Vite origin `http://127.0.0.1:5173`, plus explicit localhost/callback redirects. The frontend prototype is under `prototype/` and does not connect to local Supabase yet. Email is captured locally. Phone signup is currently **disabled** until the selected delivery hook/provider is implemented. The CLI disables phone login without one. A **local-only synthetic fixture is reserved** for that phase:

- Phone: `+12025550123` (fictional reserved number).
- Temporary test OTP: `482913`.

After configuring a local delivery hook/provider and enabling phone signup, test with `signInWithOtp({ phone: '+12025550123' })` and verify with `verifyOtp({ phone: '+12025550123', token: '482913', type: 'sms' })`. The fixed mapping is intended to exercise Supabase's phone verification without delivery and has not yet been runtime-tested. It does **not** validate WhatsApp transport. The config key `sms` is Supabase's phone-auth mechanism; production WhatsApp/SMS delivery will use Twilio, with credentials configured only when provider integration is implemented. Do not copy the fixture to production. The OTP is not a permanent PIN—the user explicitly removed the PIN feature.

Existing-admin provisioning with email/password is confirmed for staff; no staff account or permissions are seeded. MFA is not mandatory per the user's decision. Member sessions will persist without a fixed lifetime, using rotating refresh tokens. Registration requires both email and phone OTP; later login accepts either. Twilio WhatsApp is primary with SMS fallback. Resend is confirmed for verification and transactional emails. The planned member login options are “Login com whatsapp” and “Login com email”. Public signup must never create privileged role assignments.

## Migrations and tests

The initial migration creates an unexposed `private` schema and default-deny bootstrap table. Seed is idempotent and contains no personal data. The pgTAP suite checks migration, fixture, RLS and role grants. It is an infrastructure smoke test, not proof that future application authorization is implemented.

Add domain migrations only after relevant decisions are resolved. Add RLS/grant tests with each table, and test direct API denial as part of feature implementation. Future browser/unit/E2E tooling belongs to the React phase; there are no placeholder claims of passing application tests.

## Real-phone testing later

Phone `localhost` points to the phone, not your development computer. Use an agreed HTTPS development origin/reverse proxy and explicitly configured API origins/redirects for real-device camera/PWA tests. Do not expose Studio, Postgres or local service-role credentials to a public tunnel. Production uses separate Supabase projects and secrets, not this local configuration.

## Frontend deployment preparation

`vercel.json` prepares Vite output in `dist`, filesystem-first asset serving and SPA deep-link fallback. Hashed assets use immutable caching; PWA entry files revalidate and missing worker/assets return 404. The user manages deployment. The standalone frontend and `build` script now exist in `prototype/`. The root Vercel configuration builds that folder; `prototype/vercel.json` also supports using it as the Vercel root. No live deployment was performed. Configuration is based on [Vercel Vite guidance](https://vercel.com/docs/frameworks/frontend/vite).

Test-only Portuguese legal/content fixtures are in `docs/legal-mocks/`. They carry the user's exact AI warning and require replacement before production.
