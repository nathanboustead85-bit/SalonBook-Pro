# Phase 26.11 — Real Firestore abuse-budget emulator tests

Runs the **unwired Phase 26.10 prototype** against a real local Firestore emulator and Firebase Admin SDK. Checks concurrent transaction contention, per-identity caps, shared risk-signal caps across rotating accounts, business-wide caps, isolation between businesses, hourly reset, retry delay, and no partial increments on rejection.

## Safety and remaining work
- Emulator project: `demo-boustio-phase2611`; production credentials are not used.
- `BOUSTIO_CHAT_ENABLED=false` throughout CI.
- No production deploy, no callable integration, no change to existing bookings.
- The risk signal in tests is synthetic; production must derive signals from trustworthy server-side inputs with a privacy review, not user-provided identifiers.
- Business-wide caps can unfairly block legitimate users; adjust with operational monitoring and an escalation path.
- App Check enforcement, staging authenticated HTTP tests, production integration, replay/idempotency controls, and TTL configuration remain launch blockers.
