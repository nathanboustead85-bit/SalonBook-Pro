# Phase 20.14 — Security and failure testing

**Production status: NO-GO.** Public registration and customer bookings remain disabled. No deployment or production Firebase changes.

Five isolated Playwright Chromium tests exercise the existing fail-closed dashboard session controller using injected SDK adapters:
- Token expiry/revocation rejects authentication and clears previously displayed private profiles.
- Firestore permission-denied errors hide private data; stale owner callbacks and cross-owner profiles cannot be displayed.
- Cached snapshots after simulated interruption are never accepted as fresh; a server-origin valid snapshot can recover.
- A late token-validation result after sign-out cannot reattach a stale owner.
- Unverified authentication and profiles that enable bookings or publishing are rejected.

These tests do not use real Firebase credentials, real browser network failures, or deployed Firestore security rules. Existing emulator tests continue to cover the isolated Firebase rules. The 43 emulator tests plus previous 11 Chromium tests plus 5 new tests yield **59 expected tests**. Do not mark phase passed until GitHub Actions verifies them.

No Android appointment records were touched.
