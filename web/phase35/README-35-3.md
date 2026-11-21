# Phase 35.3 — Isolated authentication lifecycle and safe recovery

Uses **real Firebase Auth and Firestore emulators** on localhost under demo project `demo-boustio-phase35-3`. Creates and signs in a dummy Auth emulator account, checks the initial unverified token, and signs out. Firestore rules tests use verified/unverified simulated security contexts; they do **not** claim the dummy Auth account was verified through an actual email link. Tests also exercise actual Firestore read-only transactions.

The isolated `createAuthLifecycle` coordinator requires an explicit verified owner session with an expiry timestamp. It invalidates dashboard state on sign-out, account switch, verification revocation, expiry and network failure; late in-flight results cannot repopulate private data. Reconnection requires a new explicit verified session. It does not automatically refresh or verify real ID tokens: the caller must derive session details from a trusted Auth SDK listener and token refresh. Token revocation and server-side invalidation remain future launch blockers.

No live app wiring, real credentials, production Firestore, booking data, payments, messaging, or deployment. Existing Firestore rules and production config remain unchanged. Original Android appointments remain untouched.
