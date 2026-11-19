# Phase 27.4 — Privacy-minimised messaging abuse monitoring (isolated prototype)

**Status: offline aggregate evaluator only. Not deployed, not connected to live customer messaging.**

This module validates aggregate counters and produces review alerts for excessive rate-limit rejection, App Check rejection, authentication rejection, server errors and inconsistent totals. It rejects unexpected fields, including customer identifiers, message text, IP addresses and tokens, and returns only fixed aggregate fields.

## Launch requirements still outstanding
- Implement a trusted server-side source for aggregate counters; client-provided metrics must never be trusted.
- Define alert delivery, operator access, escalation, on-call ownership and false-positive review.
- Add retention controls and verified Firestore TTL configuration for any stored metrics/budget documents. Existing `expiresAtMs` values do not configure Firestore TTL.
- Review GDPR/privacy obligations and avoid collecting conversation content, raw IP addresses or fingerprints.
- Run realistic emulator/load tests and monitor costs. Alerts must not automatically block legitimate customers based on unverified counters.
- App Check attestation, anonymous identity correlation and real callable transport verification remain separate blockers.

No production deployment, external notification, customer messaging activation or appointment modification.
