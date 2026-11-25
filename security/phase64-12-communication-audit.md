# Phase 64.12 — Customer communication audit

Status: offline preview only. Final CI and Samsung verification pending. This is not production approval.

## Evidence
Phase 64.11 run 45692240847: signing preflight, full isolated Android JVM regression suite, APK package/version/isolation/signature checks and artifact upload succeeded.
Phase 64.12 repeats the full suite and signed isolated build. Existing booking and client stores are not migrated or edited by this phase.

## Scope
Cancellation projection, deletion confirmation policy, availability projection, reminder tombstone verification, customer preference checks, business controls, plain-text templates, independent simulated channels, durable recovery, history and delivery status. Recovery reserves UNKNOWN before simulation; only definite non-submission permits retries (30s then 120s, maximum three attempts). Acceptance is not delivery.

## Outstanding launch gates (all open)
- Authoritative authenticated business/customer identities, contact ownership, consent and business settings, server time and revision checks. Caller-supplied snapshots are not authoritative; settings can change between check and simulated submission.
- Atomic backend cancellation, availability release, reminder suppression and durable outbox across devices; concurrent actual booking cancellation not verified. Current cancellation returns a projection and caller must commit it. Deletion guard accepts caller-provided history-retained flag.
- Real email and official WhatsApp provider integration, approved templates, opt-in, verified sender and recipient mapping, signed webhooks, provider idempotency and reconciliation of uncertain outcomes. Booking URL route must be verified.
- Durable cross-process coordination, scheduled workers, retry expiry, clock rollback/forward protection, capacity/retention, backup and recovery including total file loss. Local checksums are not authentication. Separate history, status, schedule and recovery files are not transactional; partial repair is limited and conflicting histories require reconciliation.
- Dashboard and Android integration, live cancellation/deletion UX, customer communication settings and visible status; no real sends or live feature enablement in this phase.
- Privacy and abuse review, retention/deletion policy, rate limits, cost controls, operational monitoring, incident response and independent staging evidence.
- Real multi-device staging tests, provider outage tests, production deployment approval and closure of existing project-wide launch blockers. This list does not supersede prior blockers.

## Samsung verification after green CI
Install signed isolated APK as an update, never uninstall or clear data. Verify app opens, two original DEV appointments unchanged, saved clients/contact details and Client Data Integrity Check unchanged, dashboard alignment and calendar navigation intact, no unexpected notifications. Do not cancel or delete original appointments. Record user confirmation before marking phase complete.

No live bookings, payments, messaging or deployment authorised.
