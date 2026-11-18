# Boustio Phase 21.1 — Real Firebase browser integration plan and isolated staging readiness

**Status: planning and automated readiness gates only. Release decision: NO-GO.** No staging or production deployment is authorized by this phase. Public registration and customer bookings remain disabled. Do not alter or seed real customer/Android appointment records.

## Current verified foundation
Phase 20 CI run 44411589620 passed 64/64 tests: 43 Firebase Auth/Firestore emulator tests, 16 Chromium browser tests using isolated adapters, and five consolidated readiness checks. The browser session and recovery foundations are opt-in and not wired to a deployed dashboard. These successes are **not** real browser Firebase SDK integration evidence.

## Proposed isolated staging architecture
1. Create a **separate** Firebase project for staging, never the current production project. Require explicit approval and project-ID verification before creation, configuration or deployment. Prefer emulator-only tests first.
2. Use a staging-only hostname with access restrictions, no indexing, and an explicit staging indicator. Do not point boustio.co.uk at staging without authorization.
3. Provide a browser Firebase SDK adapter using Firebase Auth's `onAuthStateChanged`, `onIdTokenChanged`, `getIdTokenResult(user, true)` and Firestore's `onSnapshot` with metadata changes. Scope profile documents to the authenticated verified owner's UID; require server-confirmed snapshots before showing private data.
4. For emulator-based browser testing, use `connectAuthEmulator` and `connectFirestoreEmulator` against `demo-boustio-phase21` or another explicit demo project. Never infer emulator mode from hostname alone. Fail closed if an expected emulator endpoint is missing.
5. Keep browser persistence explicit and tested: initial load, reload, new tab, sign-out, token refresh/revocation, owner switch, offline/online transitions, permission denied and listener cleanup.
6. Keep public signup, booking creation and publication paths disabled in both UI and backend. Test only **synthetic** businesses and appointments with names distinct from real data.
7. Use GitHub Actions with read-only repository permissions, ephemeral emulators, no Firebase deployment credentials, and no production secrets. Protect eventual staging credentials in a separate manually approved workflow.

## Next implementation stages
- **21.2:** create a test-only real Firebase browser SDK adapter and emulator configuration with fail-closed defaults.
- **21.3:** execute real browser Auth/Firestore SDK tests in Playwright against ephemeral Firebase emulators.
- **21.4:** validate two independent Chromium contexts and refresh/offline behavior with real SDK state, plus cross-owner Firestore rules.
- **21.5:** design a separate staging deployment workflow gated by explicit approval; do not run it automatically.
- **Later:** two physical-device tests, business-owner acceptance testing, security/privacy review and a separate launch authorization.

## Required release gates
- Authenticated and email-verified owner only; no cross-owner reads or writes.
- No stale cached profile displayed as server-confirmed after reconnect.
- Real SDK token refresh, logout, permission denial and session persistence tested.
- No production Firebase project ID, credentials, deploy commands or live booking flags in automated test jobs.
- Firebase usage budget alerts, audit logging, rollback and access-control checks documented before any future staging deployment.
- Original two Samsung appointments checked independently before any eventual release.

**Phase 21.1 exit criterion:** plan committed and isolated readiness checks green in GitHub Actions. This does not mean staging is deployed, real Firebase browser SDK is integrated or Boustio is production-ready.
