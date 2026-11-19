# Boustio Phase 22.1 — Business dashboard Firebase integration foundation

**Implementation committed; CI verification pending. Release decision: NO-GO.**

This opt-in module composes the existing Phase 21.2 real Firebase SDK adapter with the Phase 20 dashboard session controller. It requires explicit Auth and Firestore instances, a matching isolated `demo-boustio-phase21` project, modular SDK modules and an onState callback. It does not initialize Firebase, start itself, alter the dashboard HTML or connect to the public website.

The integration exposes a minimal immutable owner-scoped business profile only after verified authentication and a server-confirmed Firestore snapshot. Cached, published, cross-owner and booking-enabled profiles are rejected. Logout clears the profile; stop unsubscribes listeners. All public registration, customer bookings, live dashboard and integration activation flags remain false.

Six automated tests exercise flags, production project rejection, verified owner, unverified owner, cached and invalid profile rejection, and sign-out/cleanup. The read-only workflow has no deployment credentials or deploy steps.

**Limitations:** These are unit tests with synthetic SDK functions. Phase 21.3/21.4 separately exercised the real SDK in Chromium, but Phase 22.1's new composition has not yet been tested end-to-end in a real browser. No UI integration, staging deployment, physical-device acceptance, production Firebase access or public signup is enabled. Existing Android appointments are not read or modified.

**Acceptance:** all six Phase 22.1 tests pass in GitHub Actions. A separate approval is required for any future website wiring or deployment.
