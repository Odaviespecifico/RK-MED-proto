# Discovery interview and answers

Atualização de 04/11/2026 (D26 em `plan.md`): o usuário substituiu Twilio pela API oficial da Meta e removeu a alternativa por SMS. As respostas anteriores abaixo são históricas.

Answers recorded 2026-10-06. Answer by number; `recommend a default` is valid for an undecided item. These questions guide implementation and do not block unrelated local setup.

## Answered in the first round

| # | Topic | Answer |
| --- | --- | --- |
| 1 | Monthly price | R$69.90. |
| 2 | Pilot target/deadline | Does not matter for current planning. |
| 3 | QR/offline | QR does not rotate; accept recommended static revocable reference and online partner validation. |
| 4 | Payment failure | Immediate loss of access; show on seller screen. |
| 5 | Retry schedule | D+0, D+1, D+3. |
| 6 | Reversal | Initially 96h; superseded by answer 22: no time limit. |
| 7 | Member auth | WhatsApp OTP. |
| 8 | PIN | Do not use six-digit PIN. |
| 9 | Mandatory MFA/invite-only proposal | No; follow-up separates staff provisioning from MFA. |
| 10 | Partner identity | Shared partner account plus employee code. |
| 11 | Directors | Identifiable member records; precise fields pending. |
| 12 | Operational changes | Admins and RK support. |

## First-round answers 13–20 (received)

13. Stripe confirmed; Z-API removed. Initial answer was cut off; answer 27 confirms Twilio WhatsApp/SMS plus email verification. Resend confirmed in the latest reply. First registration requires both email and phone OTP; subsequent logins accept either (latest follow-up).
14. Include all member features; indefinite offline retention. All connectivity-dependent actions disabled offline; no queue (confirmed follow-up).
15. Face detection only.
16. Ivory/charcoal/muted-gold direction selected.
17. Portuguese only; Android and iPhone mix.
18. User manages frontend hosting, likely Vercel; requested vercel.json.
19. Not approved; test mock text requested with exact AI warning.
20. Highest priority is scanning member QR and recording the purchase.

## Original first-round questions (for context)

13. Confirm Stripe, Z-API and Resend or name replacements. Are test accounts available? Do not send secrets in chat.
14. Which member features ship: digital card only, savings totals/history, partner search, billing management, support? Which work offline, and for how long may cached data persist?
15. Photo requirement: detect a face, human review, or identity verification? What happens when the check fails?
16. Is there a logo, palette, typeface or Figma reference? May the design use ivory/charcoal/muted gold?
17. Portuguese only? Primary age range and Android/iPhone mix?
18. Preferred frontend host/domain and monthly infrastructure ceiling?
19. Are terms, privacy notice, photo consent, retention rules and message templates approved? Who owns approval?
20. What is the first release's most important outcome, and which features can wait?

## Answers 21–27 (received)

21. Partner searches exact CPF and verifies the picture; no member PIN.
22. Ignore the 96-hour limit. Reversals in the admin panel have no time limit.
23. Failed payments appear in an admin section for customer support and manual collection.
24. Admins cannot view full CPF; allow lookup and mask display. Server outputs will be masked too so the UI cannot reveal raw data.
25. Existing-admin staff provisioning with email/password is acceptable for this version; no mandatory MFA.
26. Validate employee codes against an admin-managed employee list once per work session (confirmed in follow-up).
27. Indefinite member sign-in. Add email verification plus WhatsApp and SMS through Twilio.

## Original follow-up questions (answered above)

21. Without PIN, how does a member without a phone/battery get a discount: partner CPF lookup plus photo, support authorization, or wait until QR available?
22. Are only admins/support allowed to reverse records, and is 96h a strict limit for everyone?
23. Show payment failure only when scanning a member, or also in an RK sales/support queue?
24. May directors see CPF/contact information, or only name/status/savings?
25. Is staff provisioning by an existing admin acceptable, using email/password and no mandatory MFA?
26. Is employee code a non-secret attribution label or a checked secret? Who creates, disables and resets codes?
27. Should members remain signed in on their own phones, and for how long?

## Detailed product interview

### Authentication and recovery

28. ANSWERED: first registration requires email OTP AND phone OTP; later login accepts either. WhatsApp is primary, SMS fallback.
29. ANSWERED: Resend for emails. Two member login options: “Login com whatsapp” and “Login com email”. Enrollment verifies both; later login uses either, with SMS fallback within WhatsApp.
30. How should support verify a person who lost their WhatsApp number before changing it? Email verification is in scope; may verified email authorize phone recovery?
31. Can two family members use the same phone/email, or must each adult have unique contact details?
32. Allow multiple signed-in phones? What happens when a phone is stolen—logout devices, revoke card, both?
33. Is optional administrator MFA acceptable later? Should sensitive support changes require a fresh login or another staff member's review?

### Membership and money

34. Email verification is in scope. Which enrollment fields can support edit and which edits require reverification?
35. Can a canceled member reactivate immediately through checkout, or only through support?
36. Should cancellation remain support-only? Does paid access continue until the paid period ends as in the source?
37. What wins if an administratively blocked member pays an overdue bill? Recommend retaining the independent manual block.
38. How should refunds/disputes/chargebacks affect access, notifications and reports?
39. Do discounts apply to any purchase value? Maximum sale amount, decimal discount precision and agreed rounding rule?
40. Is the discount always per establishment, with segment defaults, or may branches/products differ?
41. Are reversals full-only or partial? Should the member be notified, and should displayed savings decrease immediately?
42. Define dashboard revenue: collected cash, billed invoices or recurring run rate? Define churn and treatment of failed payments/cancellations/reversals.

### Partner operation and member privacy

43. Who registers partners/employees, and are there multiple branches per company?
44. Which devices are at the counter: Android phone, iPhone, tablet, or desktop with camera? Is Wi-Fi reliable?
45. Should partners see only their own sale history and member first/last name, as in the source?
46. Should repeated scans be unlimited? How should accidental duplicate sales be detected without blocking legitimate same-day purchases?
47. Full CPF is hidden from staff. May support export other contact information, and which actions remain admin-only?
48. Can member photos be cached on personal phones? Shared-phone use? Indefinite retention is confirmed; desired local unlock experience?
49. When offline, should savings show the last synced total with a timestamp, or be hidden entirely?

### Communication, visual design and operations

50. Who receives failed-payment notices, prolonged partner inactivity, and suspicious-use alerts? What response time is expected?
51. What are the real support WhatsApp number and hours? Is the document's weekday 08–18/Saturday 08–12 schedule correct?
52. Should the top-10 partner customer ranking ship? Can identifiable rankings be shown to all staff?
53. Need dark mode, large-text mode or especially simple navigation for older users? Any app/site design references?
54. Is public acquisition/SEO part of first release or is this initially an invitation-only club?
55. Which analytics provider, if any, and what consent rules has the project approved? Keep member/admin data out of analytics.
56. Who owns production Supabase/Stripe/messaging accounts, domains, backup restoration and incident response?
57. Is existing member/partner data being imported? If so, what format and how will consent/payment ownership be reconciled?
58. Which real phones and people are available for usability/acceptance testing?
59. May the browser use Supabase Auth and safe RLS-controlled reads directly, with privileged commands in Edge Functions, or must every data read use an API?
60. Is versioned checkbox acceptance sufficient for membership terms, or is a generated/signed contract required?

## Environment blocker

Docker is installed but the current user cannot access `/var/run/docker.sock` (root:root). Passwordless sudo is unavailable. The user was asked to enable their preferred Docker access setup and report when `docker info` succeeds. Never collect the host password in chat or make the socket world-writable.

## Latest focused follow-ups

61. ANSWERED: both Stripe payment/update-card link sending and retry of the existing unpaid invoice, with explicit confirmation, audit and duplicate-charge protection. No second invoice for the same debt.
62. ANSWERED: employee code once per work session. Validate against the active establishment employee list server-side; retain attribution and support an explicit operator switch.

Docker remediation: user said they will fix access ASAP; no confirmation of successful `docker info` yet.

Offline action follow-up confirmed: disable everything that needs connectivity while offline. No deferred command queue. SMS fallback improves delivery but cannot guarantee receipt when both channels are unavailable.
