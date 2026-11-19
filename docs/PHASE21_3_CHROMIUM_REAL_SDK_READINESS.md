# Phase 21.3 — Real Chromium + Firebase SDK emulator integration

**Status:** committed; GitHub Actions results pending. **Release verdict: NO-GO.**

## Implementation
- Browser-only entrypoint bundles the **real modular Firebase browser SDK** with the existing Phase 21.2 adapter and Phase 20 dashboard session controller.
- Ephemeral HTTP origin serves the bundled JavaScript to headless Chromium. Firebase Auth and Firestore connect only to loopback emulators in `demo-boustio-phase21`.
- Four Playwright integration tests cover verified owner profile display and sign-out, unverified-user rejection, account switching without old-owner profile exposure, and browser reload session persistence.
- Synthetic test users and profiles are created only in the emulators. No deployed website or production credentials are used.
- GitHub Actions uses read-only repository permissions, no secrets and no deploy commands.

## Remaining limitations
- The browser harness is **not wired to the public Boustio website**.
- Chromium is a test browser; two physical devices, broader offline/reconnect scenarios and independent production-equivalent rules review remain future work.
- No real customers, customer bookings, public business registration, live dashboard, Android appointment data or production Firebase services are enabled or modified.
- The original two Samsung appointments should be independently verified before any eventual release.

**Acceptance:** all four Chromium real-SDK tests pass in GitHub Actions. If a test fails, Phase 21.3 remains incomplete until corrected and rerun.
