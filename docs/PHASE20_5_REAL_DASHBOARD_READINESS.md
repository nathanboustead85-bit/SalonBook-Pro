# Boustio Phase 20.5 — Real Firebase Dashboard Emulator Integration

**Release decision: NO-GO.** No production deployment or live feature activation.

## Added integration coverage
- Real Firebase Auth and Firestore SDKs running against local demo-project emulators.
- Verified email via emulator out-of-band code flow, force-refreshed SDK token.
- Inject real SDK listeners into Phase 20.4 dashboard session controller.
- Confirm verified-owner dashboard profile loading and listener teardown on sign-out.
- Confirm account switching never displays the previous owner's profile.
- Confirm explicit reconnect unsubscribes previous listener and recovers the correct owner profile.
- Confirm unverified accounts cannot establish private dashboard listeners.
- Run all Phase 20.1–20.5 tests in the existing GitHub Actions emulator workflow.

## Limitations
- Tests are in Node with Firebase emulators, not the deployed Boustio website or Samsung browser.
- Explicit reconnect is tested; forced network interruption, automatic backoff, token revocation and offline cache behaviour still require later coverage.
- Controller is dependency-injected and not wired into production.
- GitHub Actions must pass before declaring this phase verified.

**Public registration and customer bookings remain disabled. Existing Android appointments are untouched.**
