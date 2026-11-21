# Boustio Phase 32.10 — Final isolated Phase 32 audit

This is an **aggregate verification workflow**, not a production launch approval.

The GitHub Actions job runs:
1. Phase 32.1 and 32.2 offline staging guards, Phase 32.9 content corruption/recovery tests and Phase 32.10 workflow safety assertions.
2. Phase 32.3 isolated Firestore/Auth deny-all emulator smoke tests.
3. Phase 32.4–32.8 real `firestore.rules` emulator tests, including owner isolation, concurrent booking write restrictions, booking-mode/migration behaviour and malformed business payload rules.
4. Phase 31, Phase 30 and Phase 29 regression suites.
5. A no-deployment guard.

Both emulator invocations explicitly use `demo-boustio-phase32-staging`. No production project credentials, Firebase deployment commands or Android device access are used. Existing two Android appointments are not accessed.

**Known limitations:** Phase 32.9's proposed `pricePence` preview-only schema is not mapped into existing production business data. Firestore rules enforce string/size constraints on `liveData.json` but do not parse or semantically validate JSON. Phase 32.7 tests the existing legacy booking-mode exception rather than assuming all owner writes are disabled. Passing this audit does not establish real cloud integration, payment readiness, customer messaging readiness, deployment readiness or live booking safety.

A green GitHub Actions run is required before Phase 32.10 can be called verified.
