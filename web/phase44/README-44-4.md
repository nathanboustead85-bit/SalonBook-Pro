# Phase 44.4 — Isolated trusted-backend resilience and concurrency

Read-only concurrency boundary around Phase 44.3 owner-scoped business data projection. Latest-request epoch fencing, account switch invalidation, offline and sign-out clearing, teardown protection, post-read revocation checks inherited from Phase 44.2, and safe reconnect with fresh credentials. Synthetic Firebase emulator fixtures verify Firestore owner isolation and profile/services/staff recovery.

This is **not a real trusted backend**. Injected verification and read callbacks cannot establish production authorization, atomic App Check replay enforcement or cross-device consistency. All Phase 43 launch blockers remain open. No real Android appointments accessed, migrated or edited. No production Firebase changes, no live bookings, payments, messaging or deployment.
