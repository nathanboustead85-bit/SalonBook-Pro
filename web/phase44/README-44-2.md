# Phase 44.2 — Isolated owner session authorization

This dependency-injected read-only owner session composes Phase 44.1 Admin Auth/App Check contracts with owner-scoped read callbacks. It re-verifies authorization after reading, rejects cross-business data substitution, expired/revoked identities and reused App Check credentials, and fences account switches, offline recovery and delayed responses.

**Not a real trusted backend.** All verifiers and reads are synthetic or emulator-only. An injected callback is not an enforcement boundary in production. Real Firebase Admin initialization, actual App Check attestation consumption, server-side authorization, atomic replay controls and staging verification remain open launch blockers. No production data or Firestore rules changed; no Android appointment access or migration; live bookings, payments, messaging and deployment remain disabled.
