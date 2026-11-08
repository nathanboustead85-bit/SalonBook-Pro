# Boustio Phase 11.1 — Production readiness assessment and safe delivery roadmap

**Status: ASSESSED / DEVELOPMENT ONLY. Production HOLD.**
**Branch:** `phase-9d4-teal-clients`
**Review date:** 2026-11-08
**Evidence:** repository files inspected on this branch, plus Phase 10.59 emulator safety run https://github.com/nathanboustead85-bit/SalonBook-Pro/actions/runs/42532866245 (203/203 tests passing).

## Executive assessment

Boustio has an Android business-management foundation, catalogue publishing, a hosted website and booking-preview UI, plus substantial emulator-only security regression coverage. It is **not production launch ready**. The active functions/index.js exports `publishBusiness` and `unpublishBusiness` only. Public catalogue publishing explicitly sets `acceptingBookings:false`. The `website/book/index.html` appointment confirmation and customer messaging controls are disabled previews. Do not mistake the preview slot selector or prior isolated slot tests for a live, transactional reservation service.

The README.md still describes the Milestone 1 starter and is outdated relative to later implementation; reconcile documentation during readiness work.

## Architecture inventory (verified in branch)
| Area | Current evidence | Readiness |
|---|---|---|
| Android business app | Previously verified service/staff/calendar/bookings, local persistence, cloud backup and restore; fresh end-to-end APK validation still required | Partial |
| Auth and Firestore | Verified-owner rules and legacy booking write guard; Admin SDK bypasses client rules | Partial |
| Public business catalogue | publish/unpublish callable exports, owner checks, slug reservation, published records set acceptingBookings:false | Catalogue only |
| Public customer website | `firebase.json` serves `website/` and rewrites `/book/**`; `website/book/index.html` displays preview only | Not bookable |
| Live booking backend | No active customer booking callable exported from `functions/index.js` | Blocked |
| Messaging | Customer page chat controls disabled; no production messaging service verified | Planned |
| Payments | No integrated provider/checkout/webhook or merchant onboarding verified | Planned |
| Domain | `boustio.co.uk` owned; `functions/index.js` defaults to Firebase Hosting URL until explicitly configured | DNS/HTTPS validation required |
| Security | 203/203 isolated tests passed; durable audit and role separation are prototypes | Production HOLD |

## Release-blocking workstreams, in priority order

### P0 — Security and data safety (must precede any live writes)
1. Specify production trust boundaries, operator key custody, service identities, immutable independent audit, least-privilege enforcement and review by an independent security professional. Firestore rules cannot restrict Admin SDK.
2. Resolve cross-store audit issuance crash window; add idempotent reconciliation without manufacturing receipts from mutable data.
3. Preserve existing cloud booking data. Establish read-only inventory, hashes, documented backups, restore drills and reversible migration/cutover design. **No deletion, freeze or mode initialisation without explicit future authorisation.**
4. Threat model customer identity, public endpoints, abuse/rate limits, App Check decisions, consent, retention, and incident response.

### P1 — Transactional booking engine (develop in isolated emulators first)
5. Design server-authoritative availability from business/staff hours, service duration, breaks, time zones/DST, closures and capacity; use consistent Europe/London date/time semantics.
6. Implement booking creation as an idempotent, authenticated/appropriately verified and rate-limited server transaction with overlap/lock prevention, no phantom slots, retry handling and concurrency tests. Use **synthetic demo businesses and bookings only**.
7. Build cancellation, rescheduling, confirmation, no-show and staff edits with owner/customer permissions, audit events and notifications.
8. Test owner Android calendar consistency and recovery; prevent duplicate writes and old-client conflicts.
9. Only after separate approvals and controlled rollout planning should production activation be considered. Keep public booking disabled now.

### P2 — Messaging and customer experience
10. Design web-based customer-to-business messaging (no separate customer app), with secure conversation access via booking-scoped or verified customer identity, consent, anti-spam and moderation/reporting.
11. Add image attachments only with secure uploads, file-size/type validation, malware scanning, storage limits, expiring access and deletion/retention controls.
12. Build owner inbox in Android, delivery/read state, notifications, abuse throttling, customer privacy and offline/reconnect behaviour.
13. Accessible responsive booking page, service/staff selection, confirmation emails, QR/deep links, clear privacy and cancellation notices.

### P3 — Payments and commercial launch
14. First support **reserve online, pay in salon** without handling customer card data; establish clear booking cancellation/no-show terms.
15. Evaluate a regulated payment processor for optional deposits, prepayment and business subscriptions; design connected-account payouts, webhook signature validation, refunds, chargebacks, reconciliation and tax/VAT implications. Do not store raw card details.
16. Confirm two-tier SaaS pricing, billing grace periods, trials, invoicing, support and fair-use limits.

### P4 — Launch operations
17. Validate custom domain DNS, HTTPS, hosting redirects, privacy/cookie policy, UK GDPR data processing, retention, deletion/export and subject-access workflows.
18. Add CI release gates, separate staging and production projects, secrets management, monitoring, alarms, backup/restore, incident playbooks and rollback procedures.
19. Pilot with consenting test businesses, synthetic bookings initially; measure successful bookings, duplicates, cancellations, notification delivery, support load and billing failures.
20. Review commercial readiness, accessibility, Android compatibility, support processes and marketing before requesting explicit launch approval.

## Proposed safe Phase 11 milestones
| Phase | Deliverable | Gate |
|---|---|---|
| 11.2 | Production architecture, data safety and trust-boundary design | Documented design; no deployment |
| 11.3 | Booking engine API contract and emulator-only booking tests | Concurrent bookings, DST, idempotency and owner permissions passing |
| 11.4 | Android calendar and web preview integration in demo environment | End-to-end synthetic booking tests; no live activation |
| 11.5 | Secure web chat and photo-message prototype | Access-control, retention and upload security tests |
| 11.6 | Pay-in-salon checkout and optional payment provider architecture | No real transactions without explicit approval |
| 11.7 | Domain, privacy, reliability and operational launch checklist | Independent review and rollback rehearsal |
| 11.8 | Pilot readiness decision | Explicit separate authorisation required for any production change |

## Acceptance criteria before production approval
- Independent security review of deployed identities, audit and key management; no unresolved critical/high-risk findings.
- Real server-side booking transaction proven against concurrent requests, replay and clock/DST edge cases.
- Preservation and recoverability of all pre-existing customer/booking data independently verified.
- Clear customer identity and privacy model; functioning support, retention and incident response.
- Payments compliant with provider requirements; secure webhooks and reconciliation if activated.
- Staging deployment and rollback tested; monitored pilot with written go/no-go decision.
- Explicit owner approval of **each** proposed production deployment/data change.

## Scope and limitations
This assessment does not certify production security, current domain DNS status, legal compliance or current APK functionality; those require separate verification. The Phase 10 tests ran in dedicated demo Firebase emulators, not production. No production functions, Firestore data, booking records, public booking flags, billing or domain settings were changed by this assessment.

**Decision: Continue design and isolated emulator development. Production remains HOLD.**
