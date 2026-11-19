# Phase 27.6 — Real Firestore emulator retention/deletion safety tests

This phase uses an **isolated Firebase Firestore emulator** under demo project `demo-boustio-phase276` to exercise a staging-only deletion helper. It tests expiry boundaries, missing and malformed expiry, safe no-ops, expired budget/aggregate deletion and protection against deleting bookings or conversation documents. A test sentinel booking is created **only inside the emulator**, not in the real Boustio project.

**Important limitations:** Firestore TTL is NOT being tested as a managed service here; emulator deletion uses an explicit transaction helper, not the production TTL engine. The helper is not imported by live Cloud Functions, not scheduled and not deployed. Existing budget documents store numeric `expiresAtMs`, while managed Firestore TTL requires a timestamp field and a separately configured TTL policy. Nested budget subcollections also require separate retention design; deleting a parent document does not automatically delete subcollection documents.

Next work: propose a timestamp-based TTL schema and verify it in a non-production Firebase project, with explicit review before any production policy or migration. No real bookings, messages, or Firebase production settings changed.
