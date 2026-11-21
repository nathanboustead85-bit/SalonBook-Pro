# Boustio Phase 35.5 — final isolated Firebase security and reliability audit

**Result category: isolated verification only — NOT production-ready.** The final CI workflow reruns all Phase 35.1–35.4 suites against their own localhost demo Firebase emulator projects (Phase 35.3 also runs the Auth emulator), the new static safety audit, and regression suites from Phases 29–34. No production Firebase project, credentials, live bookings, Android appointments, payments, messaging or deployment is used. Existing production `firestore.rules`, `firebase.json` and `.firebaserc` remain unchanged.

## What these tests actually verify

Phase 35.1: actual Firestore security rules, owner reads, cross-owner denial and legacy booking-rule exposure. Phase 35.2: Firestore read-only transactions plus concurrent refresh and sign-out protection. Phase 35.3: dummy Firebase Auth emulator sign-in/sign-out, isolated auth lifecycle, expiry and account switching; verification states in Firestore are test contexts, not a real verification email flow. Phase 35.4: real Firestore transactions combined with **injected** transient errors, bounded retry, cancellation and stale-data rejection. Phase 35.5: audit flags and documented launch blockers. Regression suites are re-executed independently.

## Launch blockers — not waived by a green workflow

1. A trusted production Firebase SDK adapter is not integrated into the dashboard; token refresh and auth listeners remain unverified.
2. Phase 34.1's provisional gateway expects incorrect Firestore paths, ownerId and revision fields; the actual Android schema uses `users/{uid}/business/profile` and `users/{uid}/liveData/{services|staff}` with JSON envelopes.
3. Existing rules allow verified owners to read `users/{uid}/liveData/bookings` and conditionally write legacy bookings. The isolated dashboard intentionally does not request booking documents; these legacy rules still require review.
4. The `atomic:true` and `isCurrent()` callback contracts must be controlled by trusted SDK integration, not arbitrary callers. The 35.4 retry wrapper's cancellation callback is not yet linked automatically to the auth lifecycle.
5. Expiry timestamps are supplied by the caller. Production token revocation, email verification refresh, App Check, sign-out propagation and backend invalidation are not yet proven.
6. Temporary network errors are injected in tests; genuine SDK transport interruptions, offline cache behavior and production network recovery have not been validated.
7. Phase 34.3 rejects documents older than 24 hours and timestamps more than 5 minutes apart, which may reject valid unchanged business data.
8. Business-wide opening-hours persistence, staff schedules and all Android schema variants still need validation.
9. No end-to-end Samsung/real-browser Firebase dashboard acceptance test has been completed for this integration.
10. Live customer bookings, payments, messaging and deployment remain **disabled** until separately reviewed and explicitly approved.

## Safety boundary

This audit makes no writes to production, modifies no Firestore rules, and has no deployment step. Emulator fixture writes use local demo data only. A successful audit means the **isolated test scope passed**, not that Boustio is ready to launch.
