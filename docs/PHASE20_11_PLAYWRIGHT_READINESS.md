# Phase 20.11 — Real Chromium browser recovery tests

**NO-GO for production.** Public business registration and customer bookings remain disabled. No Firebase deployment or Android appointment changes.

This phase adds a separate GitHub Actions job running headless Chromium with Playwright. It serves the existing opt-in browser connectivity and recovery modules from a loopback HTTP server, then uses Playwright's real Chromium browser context offline/online transitions to test:
- Offline event hides private profile and detaches listener state.
- Online event does not restore cached data; only a fresh owner-matching snapshot is accepted.
- Repeated offline/online transitions and account switching never show a previous owner's queued profile.
- Sign-out during an outage prevents reattachment, and stopping clears state.

**Scope boundary:** Browser tests use an isolated fake dashboard and synthetic server-snapshot callbacks. They do not load the production dashboard, use real Firebase SDK in Chromium, or simulate genuine Firestore listener transport. Previous Phase 20.9 emulator tests independently exercise real Auth/Firestore SDK network operations. This phase verifies actual browser event delivery and integration with the recovery monitor, not end-to-end live Firebase readiness.

CI: separate `chromium-browser-recovery` job with pinned Playwright 1.56.1 and a 3-minute test command limit. Existing 43 emulator tests remain unchanged. Expected total is 46 tests across two jobs. Do not mark passed until both GitHub Actions jobs succeed.
