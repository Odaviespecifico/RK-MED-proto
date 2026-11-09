# RKMED — demonstração da interface

React + Vite prototype for the RKMED Linha Gold experience. The demonstration adapter in `src/mocks/` runs in the browser with fictional data. It does not connect to Supabase, Stripe, Twilio or Resend. The separate sandbox mode uses real integration modules without demo fallback.

```bash
npm ci
npm run dev
```

Open <http://127.0.0.1:5173>. For a production-style PWA preview, run `npm run build` then `npm run preview`. The application now lives at the repository root with one package, lockfile and Vercel configuration. No deployment was performed. See [application setup](desenvolvimento.md).

## Demo journeys

| Journey | Demo values |
| --- | --- |
| Member email login | `ana@exemplo.com` → OTP `123456` |
| Member SMS login | `81999990001` → OTP `123456` (resend stays on SMS) |
| Existing member | Ana Paula Lima is active; Carlos Henrique Silva is blocked. |
| Partner login | `parceiro@rkmed.demo` / `demo123` |
| Partner employee | Select Laboratório Vida and enter `2468` for Marina Costa. Admin can register more employees, change codes and deactivate accounts. |
| Partner card lookup | Scan Ana's QR from another screen, or paste `RKMED-GOLD-ANA-8F4D7C2A`. |
| No-phone fallback | Search Ana's CPF `12345678909`, then confirm her photo. Carlos' CPF `98765432100` demonstrates blocked access. |
| Admin login | `admin@rkmed.demo` / `demo123` |
| Director viewer | `diretoria@rkmed.demo` / `demo123`; collections and reversal actions are hidden. |
| New enrollment | Enter name, birth date and an unused valid CPF; then SMS, its demo code `123456`, e-mail and its demo code `123456`. The front camera opens automatically on the photo step and detects a face live. The photo is captured live only; choosing or uploading a file is not available. After the photo, the payment step opens with the R$ 69,90 monthly plan; confirming it in demo mode activates the member. In sandbox mode the same step redirects to Stripe Checkout. The portrait in `tests/fixtures/face-portrait.jpg` is fictional test data used by automated tests. |

Member login has three screens: choose SMS or e-mail, enter that contact, and confirm its demo code. The chosen contact can be changed before confirmation. Resending keeps the selected SMS or email channel. WhatsApp is unavailable.

An initial purchase of R$200 at Laboratório Vida gives a 20% discount (R$40); the member pays R$160 directly to the partner. The purchase appears in history and savings. Admin can reverse it without a time limit. Admin collections can simulate sending a payment link and retrying the same invoice; neither action charges a card.

In the admin panel, **Parceiros** adds a name, category, discount and address. **Funcionários** registers each person under one selected partner with a unique four-digit code. In the partner panel, select that same partner when starting a work session. A code from another partner is rejected; the session, purchase records and history use the selected partner. These records persist only in this browser's local storage.

The login, OTP delivery, staff protection, payment, collections and legal acceptance are **visual simulations**. The full CPF exists in local browser state to make the demo lookup work; a frontend mask is not a privacy boundary. Do not enter real customer data or use this deployment for real purchases. Real authentication, role checks, payment verification, private photos and masked server responses belong to the Supabase implementation in `plan.md`.

## Photo detection and PWA

The enrollment camera opens on the photo step and runs Google's MediaPipe BlazeFace model locally on live video. Capture requires one sufficiently large face inside the central crop, meeting the configured confidence threshold across three consecutive checks. Set `VITE_FACE_DETECTION_MIN_CONFIDENCE=0.8` in `.env.test` (see [environment setup](ambientes.md)) to tune that threshold from greater than 0 to 1; invalid or missing values use `0.8`. Restart Vite after changing it. This `VITE_` value is included in the browser bundle, so it is configuration, not a secret. Camera permission denial and unsupported devices require a new permission attempt; there is no file upload. The captured photo is checked again on the actual 600×600 crop before it is saved as JPEG. Detection does not match a person to a document, prove liveness, or prevent someone using another person's photo. The model and WebAssembly runtime are stored in `public/` and served by the prototype. The first model load can take a moment. The photo check is a demo-side guard and must be repeated/trusted on the backend before real enrollment.

## Partner map

The public partner section and member directory show the demo partner addresses. Selecting a partner changes the address shown. For the interactive Google map, enable the **Maps Embed API** in a Google Cloud project, create a browser API key restricted to your site referrers and this API, and set `VITE_GOOGLE_MAPS_EMBED_KEY` in the root `.env.test` or the hosting environment. Restart Vite after changing the variable. Until a key is set, the page shows the selected address with an “Abrir no Google Maps” link. The current addresses and business names are fictional fixtures; replace them with verified partner locations before using the map publicly. An embed key is visible in the browser and must be restricted in Google Cloud.

The installable PWA caches the UI shell, including member routes. Mock member data and the QR persist in the browser and can be viewed after an online visit when offline. Operations that need a connection, including logins, billing changes, support messages and partner/admin activity, are disabled offline. Browser storage may be cleared by the user or evicted by the browser. Uploaded-photo detection assets are not precached; run enrollment online. Install and camera access on a phone require HTTPS (or local `localhost` for development).

The default seed uses a generated fictional portrait for Ana. It is located at `public/demo-ana.webp`, with a JPEG conversion in `tests/fixtures/`. Test terms and privacy text are visibly labeled with the required warning: “Esse texto deve ser modificado por ter sido inteiramente gerado por IA e serve apenas para testes.”

## Verification

```bash
npm run typecheck
npm run test
npm run build
```

`node tests/flows.mjs` exercises the main flows in local headless Brave while `npm run dev` is running. `node tests/mobile-layout.mjs` checks public, member, partner and admin pages at 320, 360 and 390 px for horizontal overflow and small navigation targets. `node tests/admin-directory.mjs` checks partner and employee registration and partner-specific work sessions. `node tests/live-camera.mjs` checks live detection and capture using a synthetic camera feed made from the fictional portrait. These tests need Brave at `/usr/bin/brave-browser`; the main flow writes screenshots to `/tmp`. These browser tests are optional on machines without Brave. Real phone camera behavior still requires Android and iPhone testing over HTTPS.
