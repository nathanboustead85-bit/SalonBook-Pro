# Phase 11.3 — Isolated demo booking engine

**Development prototype only. Production HOLD.**

The non-exported `functions/phase113DemoBookingEngine.js` provides a trusted-construction-time `createDemoBookingEngine({db,verifyCustomer})` factory. It requires both Firebase Auth and Firestore emulator host variables, demo project IDs, and no Google Application Credentials. It only accepts synthetic business IDs beginning `demo_` and writes exclusively under `phase113DemoBusinesses/{businessId}`.

## Implemented
- Strict request field allowlist; server-side verified customer callback (test stub only).
- Service duration loaded from demo Firestore catalogue, not client-supplied.
- Demo UTC weekday hours 09:00–17:00; no claim of Europe/London/DST support.
- Single Firestore transaction reads the staff-day allocation document, checks interval overlap, then creates booking and idempotency record and updates allocation. Concurrent requests retry on contention.
- Scoped customer+idempotency key hash; repeated identical request returns original booking; same key with altered booking parameters fails.
- No access to legacy booking paths, production Firebase or booking-mode documents.

## Test coverage
Fourteen isolated integration tests: booking success, idempotent replay, conflicting replay, overlap, adjacent slots, concurrent different keys, concurrent identical retries, unauthorised customer, injected fields and non-demo business, out-of-hours/weekend, invalid timestamps, emulator guard, export isolation and legacy source preservation.

## Important limitations and next tasks
- `verifyCustomer` is supplied by trusted test code; production Auth token verification is **not** implemented.
- UTC demo hours are insufficient for UK DST, breaks, holidays, variable schedules, multi-staff capacity and appointment buffers.
- A single staff-day allocation document is an emulator prototype; assess transaction limits and scalability.
- Cancellation/rescheduling, rate limits, notifications, privacy, monitoring and real customer journeys remain unimplemented.
- Do not deploy, export the prototype from `functions/index.js`, enable public bookings, modify production Firebase, delete/freeze legacy bookings or initialise booking mode.

**Expected suite count:** 213 previously verified + 14 new = **227**, subject to GitHub Actions confirmation.
