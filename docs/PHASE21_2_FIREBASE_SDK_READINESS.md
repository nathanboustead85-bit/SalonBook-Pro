# Phase 21.2 — Real Firebase browser SDK adapter (isolated)

**Status: implemented; GitHub Actions verification pending. Production release: NO-GO.**

## Changes
- Added `website/business/dashboard/firebase-browser-sdk-adapter.mjs`: opt-in adapter around real modular Firebase Auth and Firestore SDK functions, including owner-scoped profile document references and server/cache metadata events.
- Added explicit emulator configuration helper with a strict `demo-boustio-phase21` project prefix and loopback-only endpoints. No automatic emulator connection or Firebase initialization occurs on import.
- Added four real SDK integration tests using Firebase Auth and Firestore emulators: environment rejection, verified owner dashboard and sign-out, unverified account denial, cross-owner access denial.
- Added read-only GitHub Actions workflow with ephemeral Auth and Firestore emulators and no deployment step.

## Boundaries
This tests real Firebase SDK APIs in Node against local emulators. It does **not** yet test browser bundling, deployed website wiring, browser persistence, physical-device behaviour or production Firebase credentials. Phase 21.3 will test a real Chromium browser with Firebase SDK and emulators.

Public registration, customer bookings, live dashboard and session recovery feature flags remain disabled. No production data, Android appointment records, Firebase rules or deployment settings were changed. The two existing Samsung appointments should be checked independently before any eventual release.

**Pass criterion:** GitHub Actions Phase 21.2 workflow green and four integration tests passing. Until verified, implementation is not considered tested.
