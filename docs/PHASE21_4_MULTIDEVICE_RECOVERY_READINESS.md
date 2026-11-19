# Phase 21.4 — Multi-device browser security and recovery

**Status:** implementation committed, CI results pending. **Release verdict: NO-GO.**

Four Playwright tests run the real modular Firebase Auth and Firestore SDK in separate Chromium browser contexts against ephemeral Auth/Firestore emulators under `demo-boustio-phase21`. Coverage: same-owner independent sessions and sign-out, different-owner isolation, offline interruption followed by explicit controller stop and reload recovery, and account switching after sign-out.

**Important limitation:** the offline test explicitly stops the controller on disconnection. This is **not** proof that the production browser automatically detects offline events and clears data. That requires wiring and separate testing of the connectivity coordinator. Browser contexts simulate devices; no physical-device tests have been run. No production website wiring or deployment.

The test harness uses synthetic accounts/profiles only. Public registration, customer bookings and live dashboard flags remain disabled. Existing Android appointment records and production Firebase configuration are untouched. Independently verify the two original Samsung appointments before any release.

**Acceptance:** four tests pass in GitHub Actions; if failures occur, investigate before advancing. Separate staging and production release authorization remains mandatory.
