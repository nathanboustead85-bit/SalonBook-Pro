# Phase 27.12 — Messaging security integration readiness audit

**Decision: BLOCKED.** This is a read-only audit of checked-in source code, not a production runtime audit or independent penetration test.

## Confirmed source-level status
- Customer chat has a default-off environment gate.
- The existing atomic abuse-budget integration is **optional**, controlled by `BOUSTIO_CHAT_ABUSE_BUDGET_ENABLED`; it is not enabled for live use.
- Phase 27.9–27.11 v2 counters and fail-closed recovery are isolated and **not wired** to callable handlers.
- Chat callables have `enforceAppCheck:false`; real App Check enforcement remains unverified.
- Trusted anonymous-account correlation is not integrated, and no trusted server evidence source has been established.
- Abuse monitoring/alert delivery remains an offline prototype.
- Managed Firestore TTL policies and schema migration are not configured or verified. The current budget records are nested and store numeric expiry.
- The Phase 27.1 release preflight intentionally blocks launch pending independent signoff and explicit approval.

## Recommended next priorities
1. **Stop adding isolated security prototypes without an integration plan.** Create a single staging-only acceptance matrix mapping each blocker to a real test and owner.
2. Focus parallel product work on the customer booking website, business self-signup and reliable booking flows, while keeping live booking/chat disabled until separate release checks pass.
3. Implement and verify real App Check, anti-rotation controls, retention/monitoring and authenticated client transport in staging before any production activation.
4. Independently review cost ceilings, privacy, attachments and incident response before launch.

No live feature flags, Firebase settings, appointments, or production deployments are changed.
