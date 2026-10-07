# RKMED — interactive frontend prototype

React + Vite prototype for the RKMED Linha Gold experience. Everything in this folder runs in the browser with fictional data. It does not connect to Supabase, Stripe, Twilio or Resend.

```bash
cd prototype
npm ci
npm run dev
```

Open <http://127.0.0.1:5173>. For a production-style PWA preview, run `npm run build` then `npm run preview`. The root and this folder both contain Vercel configuration; select `prototype` as the Vercel root directory, or deploy from the repository root using its `vercel.json`. Hosting remains under the user's control.

## Demo journeys

| Journey | Demo values |
| --- | --- |
| Member email login | `ana@exemplo.com` → OTP `123456` |
| Member WhatsApp login | `81999990001` → OTP `123456` (SMS fallback button is simulated) |
| Existing member | Ana Paula Lima is active; Carlos Henrique Silva is blocked. |
| Partner login | `parceiro@rkmed.demo` / `demo123` |
| Partner employee | `2468` for Marina Costa; entered once per work session. Admin can disable her or change the code. |
| Partner card lookup | Scan Ana's QR from another screen, or paste `RKMED-GOLD-ANA-8F4D7C2A`. |
| No-phone fallback | Search Ana's CPF `12345678909`, then confirm her photo. Carlos' CPF `98765432100` demonstrates blocked access. |
| Admin login | `admin@rkmed.demo` / `demo123` |
| Director viewer | `diretoria@rkmed.demo` / `demo123`; collections and reversal actions are hidden. |
| New enrollment | Use a valid, unused CPF, open the front camera for live face detection and take a photo when exactly one face is found, or choose a single-face JPG/PNG/HEIC. Then enter `123456` for both email and phone verification. The portrait in `tests/fixtures/face-portrait.jpg` is a fictional image for testing. |

An initial purchase of R$200 at Laboratório Vida gives a 20% discount (R$40); the member pays R$160 directly to the partner. The purchase appears in history and savings. Admin can reverse it without a time limit. Admin collections can simulate sending a payment link and retrying the same invoice; neither action charges a card.

The login, OTP delivery, staff protection, payment, collections and legal acceptance are **visual simulations**. The full CPF exists in local browser state to make the demo lookup work; a frontend mask is not a privacy boundary. Do not enter real customer data or use this deployment for real purchases. Real authentication, role checks, payment verification, private photos and masked server responses belong to the Supabase implementation in `../plan.md`.

## Photo detection and PWA

The enrollment camera runs Google's MediaPipe BlazeFace model locally on live video, checks about six frames per second, and enables capture when exactly one face is detected. Camera permission denial and unsupported devices can use the photo picker. Captured and uploaded photos are checked again as still images and compressed to 600×600 JPEG. Detection does not match a person to a document, prove liveness, or prevent someone using another person's photo. The model and WebAssembly runtime are stored in `public/` and served by the prototype. The first model load can take a moment. The photo check is a demo-side guard and must be repeated/trusted on the backend before real enrollment.

The installable PWA caches the UI shell, including member routes. Mock member data and the QR persist in the browser and can be viewed after an online visit when offline. Operations that need a connection, including logins, billing changes, support messages and partner/admin activity, are disabled offline. Browser storage may be cleared by the user or evicted by the browser. Uploaded-photo detection assets are not precached; run enrollment online. Install and camera access on a phone require HTTPS (or local `localhost` for development).

The default seed uses a generated fictional portrait for Ana. It is located at `public/demo-ana.webp`, with a JPEG conversion in `tests/fixtures/`. Test terms and privacy text are visibly labeled with the required warning: “Esse texto deve ser modificado por ter sido inteiramente gerado por IA e serve apenas para testes.”

## Verification

```bash
npm run typecheck
npm run test
npm run build
```

`node tests/flows.mjs` exercises the main flows in local headless Brave while `npm run dev` is running. `node tests/live-camera.mjs` checks live detection and capture using a synthetic camera feed made from the fictional portrait. Both need Brave at `/usr/bin/brave-browser`; the main flow writes screenshots to `/tmp`. These browser tests are optional on machines without Brave. Real phone camera behavior still requires Android and iPhone testing over HTTPS.
