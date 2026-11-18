# Boustio Phase 20.2 — Authentication Lifecycle Emulator Readiness

**Release decision: NO-GO.** Test-only, isolated Firebase Auth and Firestore emulators.

## Added tests
- Create synthetic email/password accounts and confirm they are unverified by default.
- Simulate email verification using the **Auth emulator-only** account update API; refresh an authentication token and check verified state.
- Refresh a session token and confirm it belongs to the same UID.
- Simulate account switching with distinct Auth emulator identities.
- Reject invalid token lookup and invalid refresh credentials, then validate fresh sign-in recovery.
- Test Firestore rules for verified owner reads, anonymous and unverified denial, cross-owner reads/writes, forbidden booking enablement and server-only booking/onboarding collections.
- Run Phase 20.1 and 20.2 suites together in GitHub Actions.

## Limits
- Firestore rules-unit-testing supplies synthetic verified/unverified claims. These tests do **not** yet pass the Auth emulator's actual ID token into a production-style Firestore client.
- Invalid tokens simulate expired/invalid sessions; real clock-based ID-token expiry and revocation propagation are not yet tested.
- Emulator-only verification is not a real email delivery or verification-link flow.
- No live account listener, customer booking endpoint or production integration was enabled.
- Emulator success must be confirmed in GitHub Actions before calling this phase tested.

## Next blockers
Real Auth-to-Firestore SDK identity propagation, email verification links, token revocation, listener teardown on sign-out/account switching, server-enforced transaction safety, browser/Samsung end-to-end checks and production security review.

**No production deployment. Public registration and customer bookings disabled. Existing Android appointments untouched.**
