# Phase 37.2 — Real browser SDK + Firebase emulator integration

This is an **isolated loopback-only** browser test application. The entry bundles the real Firebase browser Auth and Firestore SDKs and the Phase 36.5 audited read-only session via esbuild. It rejects non-loopback hostnames, uses the demo-boustio-phase37-2 project and explicitly connects to Auth emulator 127.0.0.1:19099 and Firestore emulator 127.0.0.1:18080. The test server binds only 127.0.0.1. No production Firebase configuration or deployment.

Playwright tests in Chromium exercise verified owner login, owner-specific profile/services/staff, sign-out, account switching, unverified rejection and network-recovery clearing. Firebase Admin seeds emulator-only users, rules-unit-testing seeds emulator-only documents, and actual browser SDK requests use real Auth tokens and Firestore rules. Existing Phase 36.5 security tests and Phase 37.1 browser DOM tests also run in CI.

The browser uses an 80ms polling bridge because the Phase 36.5 session exposes snapshot but not subscribe; this is suitable for an isolated preview, not a production UI architecture. Future phases should introduce reactive subscription, better accessibility, revocation handling, App Check and deployment security reviews. Bookings, editing, payments and messaging remain disabled. No Android appointments or production data accessed.
