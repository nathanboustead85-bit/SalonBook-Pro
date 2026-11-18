# Phase 20.6 — Network recovery and offline safety

**NO-GO for public release.** No deployment or production Firebase wiring.

## Added
- Optional network recovery coordinator accepting explicit connectivity events.
- On network interruption, clear all visible private profile state and detach Firestore listeners immediately.
- On reconnection, reattach only the currently authenticated user, requiring fresh verified-token and Firestore snapshot checks.
- Prevent queued callbacks from previous listener generations from restoring stale or cross-owner profile data.
- Handle repeated connectivity events without unnecessary listeners.
- Stop cleanly and prevent later connectivity callbacks from changing dashboard state.
- Added deterministic offline/reconnect/account-switch tests to existing GitHub Actions Firebase emulator workflow.

## Limitations
- Connectivity events are injected in the tests; no browser navigator event or real network disruption is simulated yet.
- Actual Firestore SDK disableNetwork/enableNetwork behavior and browser offline cache behavior remain to be tested.
- This foundation is not wired to the deployed website; automatic retry/backoff and offline persistence handling are future work.
- Existing Android appointments untouched. Public registration, customer bookings and production deployment remain disabled.

**Do not mark complete until GitHub Actions passes.**
