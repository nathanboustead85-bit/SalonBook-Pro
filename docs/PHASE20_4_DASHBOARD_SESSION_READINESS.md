# Phase 20.4 — Dashboard session integration and recovery foundation

**NO-GO for public launch.** This is an opt-in, adapter-injected foundation, not connected to production Firebase or the live dashboard.

## Scope
- Session controller observes authentication state and ID token changes through injected SDK adapters.
- Revalidates verified-email claim before starting owner-specific profile listeners.
- Explicitly clears profile and unsubscribes before sign-out, account switch and reconnect.
- Generation IDs prevent stale asynchronous verification or listener callbacks from restoring prior owner's profile.
- Listener errors hide profile and mark connection interrupted. Reconnect starts a new listener generation.
- Rejects cross-owner, booking-enabled or published private profile data.
- Test suite covers sign-out, owner switching, stale callbacks, delayed token checks, interrupted connection and reconnect.
- Runs alongside existing Phase 20.1–20.3 emulator security tests in GitHub Actions.

## Remaining limitations
- The new controller uses dependency injection and deterministic fake adapters in its tests; the existing Phase 20.3 suite separately exercises real Auth/Firestore SDKs against emulators.
- Browser UI integration, real listener reconnection timing, offline persistence, token revocation and sign-out cache handling require later end-to-end testing.
- No production connection, customer booking activation, public registration or deployment.
- Existing Android appointments were not touched.

**Verify the latest GitHub Actions run before marking Phase 20.4 passed.**
