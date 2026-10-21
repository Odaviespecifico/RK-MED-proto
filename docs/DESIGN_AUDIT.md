# Design and usability audit

Reviewed the landing page, member login, enrollment, partner directory, partner shift entry, and admin collections at 360px and 1440px. The review combined screenshots, keyboard checks, DOM checks for labeled controls and main landmarks, and the existing browser journeys. This is a prototype review, not a WCAG conformance certification.

| Finding | Change |
| --- | --- |
| The landing page used broad wellness phrases, decorative stars, invented avatar initials, and a carousel counter without a carousel. | Replaced them with concrete copy about categories, price, QR use, and online validation. Removed the fake social proof and unused carousel cue; simplified card artwork. |
| Small, pale labels made the interface hard to scan, especially on phones. | Increased body, form, table, filter, and helper text sizes; darkened muted and gold text; added a consistent keyboard focus outline. Sample colors now measure 5.99:1 (muted green on white) and 5.35:1 (headline gold on ivory). |
| Public and enrollment pages lacked a main landmark; the mobile menu had no expanded state or focus handoff. | Added main landmarks, a skip link, `aria-expanded`, and focus on the first menu link when opened. |
| The partner search lacked an accessible name, and form errors were not announced. | Added explicit search labels and live error alerts. Enrollment now moves focus to the new step heading. |
| Staff tables required horizontal scrolling that hid names and actions on narrow screens. | At phone widths, table rows become labeled records. The compact staff sidebar no longer crowds the content. |
| Dialogs did not establish keyboard focus or provide a clear dialog role. | Added dialog labels, focus containment, Escape closing, and return focus to the triggering control. |
| The Google Maps area appeared blank when no Embed API key was configured. | The selected address and an “Abrir no Google Maps” link now remain visible until the key is provided. |

The review used [WCAG 2.2](https://www.w3.org/TR/wcag/), [WAI form labeling guidance](https://www.w3.org/WAI/tutorials/forms/labels/), and [WAI keyboard and focus checks](https://www.w3.org/WAI/test-evaluate/preliminary/) as references.

## Verification

- Browser checks at 360px and 1440px found no page-wide horizontal overflow and one main landmark on each of the six audited routes. The checked form controls had accessible names.
- Keyboard checks passed for the skip link, mobile menu focus, and confirmation dialog focus and Escape behavior.
- `npm run build`, `npm run test`, `node tests/flows.mjs`, and `node tests/live-camera.mjs` passed after these changes.

## Before public use

- Replace fictional partner names and addresses with verified locations, then configure a restricted Google Maps Embed API key.
- Confirm the brand mark, typography license, content, and legal copy with the RKMED team. The legal text and demo data remain explicitly marked as test material.
- Test camera, map, screen readers, zoom, and PWA behavior on real Android and iPhone devices over HTTPS. The desktop browser audit does not establish mobile assistive technology compatibility.

## Mobile refinement, 2026-10-07

- Moved the member QR ahead of the decorative membership card on phones; the complete QR fits above bottom navigation at the tested 780px viewport height.
- Replaced the narrow staff icon rail with a labeled navigation drawer below 801px. It locks background scrolling, contains keyboard focus, closes on route selection or Escape, and returns focus to its trigger.
- Placed partner results before the map and used compact horizontal partner cards on phones.
- Increased account, billing, filter and menu targets; kept form inputs at 16px on phones. Reduced sign-in and enrollment header space.
- Constrained dialogs to the dynamic viewport with internal scrolling; added safe-area spacing to member content and notifications.
- Browser checks cover public, member, partner and admin routes at 320, 360, 390, 430 and 768px. Navigation focus checks and QR visibility assertions pass. A 360×568 check confirms billing-dialog cancellation remains reachable.

These are emulated browser checks. Physical-device camera, keyboard, safe-area and installed-PWA checks remain outstanding.
