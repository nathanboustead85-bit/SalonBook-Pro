# Boustio Phase 20.3 — Real Firebase SDK Emulator Integration

**Release decision: NO-GO.** All testing is confined to Firebase Auth and Firestore emulators under `demo-boustio-phase20`.

## Coverage
- Use real Firebase Authentication SDK users, email verification via emulator-only out-of-band codes, and force-refreshed ID tokens.
- Access Firestore through the real Firestore SDK with Auth credentials from the same Firebase app, not synthetic rules-unit-testing claims.
- Confirm verified owner access and denial of cross-owner reads/writes and enabling public bookings.
- Confirm sign-out denies subsequent private reads, then sign-in restores only the same owner's permissions.
- Confirm account switching invalidates the former owner's Firestore access.
- Exercise a dashboard preview listener lifecycle with explicit unsubscribe and generation invalidation; stale owner data is cleared before switching.
- Run all Phase 20.1–20.3 tests together through GitHub Actions.

## Limits and remaining work
- The listener controller is test-only, not wired into the live Boustio website.
- Sign-out tests verify fresh Firestore requests, not every browser cache or offline persistence scenario.
- Listener teardown is tested by explicit cleanup and state clearing, not a full browser UI race/latency simulation.
- No production Auth or Firestore connection, no public registration, no customer bookings, no deployment.
- GitHub Actions success must be verified before declaring Phase 20.3 passed.

**Legacy Android appointments remain untouched.** Production security review, UI wiring and browser/Samsung end-to-end tests remain prerequisites to launch.
