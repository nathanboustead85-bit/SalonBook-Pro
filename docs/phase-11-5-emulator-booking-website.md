# Phase 11.5 — Emulator-only customer booking website

**Status: development prototype; production HOLD. No deployment or public booking activation.**

## Components
- `demo/phase115/index.html`: separate responsive demo booking interface with service, professional, local date, live available slots, customer emulator ID token and confirmation.
- `functions/phase115DemoJourney.js`: isolated catalogue and real-time slot generation from synthetic Firestore service, staff, closures and staff-day allocations. Reuses Phase 11.4 Europe/London schedule validation and Phase 11.3 transactional booking engine. UTC slot IDs remain unambiguous across DST changes.
- `functions/phase115LocalServer.js`: loopback-only Node HTTP server, requires both emulators, project `demo-boustio-legacy-init`, and no application credentials. No Firebase Functions export or Hosting rewrite.
- `functions/phase115DemoJourney.integration.test.js`: nine tests for catalogue, staff, hours, breaks, closures, booked slots, invalid requests, Auth rejection, local HTTP website and confirmed booking with a verified Auth-emulator token.

## Local demo (developer machine with Firebase CLI)
1. Start Firestore and Auth emulators for `demo-boustio-legacy-init`.
2. In a shell with both emulator host environment variables and both project ID environment variables set to the demo project, run `node functions/phase115LocalServer.js`. It binds only to `127.0.0.1` on a random port.
3. Seed synthetic `phase113DemoBusinesses/demo_salon` service and staff records, using object intervals `{start:540,end:1020}`, and create a verified customer in the Auth emulator. Visit the printed loopback URL. No real customer account or production credential is accepted or required.

The GitHub Actions workflow automatically provisions its own synthetic fixtures and runs the HTTP end-to-end tests. It does not publish a public preview URL.

## Remaining launch blockers
No production Auth integration, abuse prevention/rate limits, CSRF/session hardening, accessibility audit, real website integration, Android calendar integration, live notifications, cancellation/rescheduling or customer data retention design. Demo requires a test ID token entered manually; production customer UX will need an approved sign-in flow. Availability is advisory and bookings revalidate atomically; time slots may disappear under contention.

Production `website/book/index.html` remains preview-only. Existing bookings and Firebase production data are untouched.
