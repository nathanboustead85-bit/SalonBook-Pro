# Phase 46.2 — Isolated backend security verification preparation

This is an **injected verification contract**, not a real trusted backend integration. The synthetic verifier must be called with `verifyIdToken(token, true)` (checkRevoked), and must reject missing, expired, stale, anonymous, unverified, cross-owner and revoked-token scenarios. It checks strict emulator-only configuration and rejects ambient credential variables. In-flight invalidation prevents stale verification results from being accepted.

A passing contract response explicitly sets `accessGranted: false`; it **does not grant reads or approve staging**. Real Firebase Admin revocation, backend identity, credential provenance and App Check remain independently unverified. All seven launch blockers remain OPEN. Production Firestore rules and data are unchanged. No live bookings, payments, messaging, deployment, migration or Android appointment access.

## Evidence still needed
- Approved staging-only backend identity and credential boundary review.
- Independent real Admin SDK `verifyIdToken(..., true)` evidence, including revocation, expiry and session invalidation.
- Approved App Check attestation and replay verification in a later controlled phase.
- Separate owner authorization and production-readiness sign-off.
