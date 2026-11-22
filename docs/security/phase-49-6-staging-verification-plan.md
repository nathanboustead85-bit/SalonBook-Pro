# Boustio Phase 49.6 — staging security verification readiness

**PREPARATION ONLY — no real staging execution, independent approval or deployment. Seven launch blockers remain OPEN.**

## Authorization prerequisites
Real staging validation requires **separate authorization** from the owner, a dedicated non-production Firebase project, an **independent reviewer**, least-privilege access and a pre-approved test plan. Never put credentials, tokens, user records, raw logs or privileged evidence in public GitHub. Production must not be used.

## Independent execution runbook (future authorized staging only)
1. Record source commit SHA, UTC, Firebase project identity, scope, reviewer identity and independence, approved evidence repository and rollback contact.
2. Prove staging/production isolation: different Firebase project IDs, data stores, service accounts, IAM roles, secret scopes and billing guardrails; use synthetic users and bookings only.
3. With authorized staging Admin SDK credentials, call `revokeRefreshTokens(uid)`; confirm the backend uses `verifyIdToken(token, true)` and rejects revoked sessions. Document that Admin SDK bypasses Firestore Rules and server handlers must check ownership independently. Firestore client tokens may remain valid until expiry absent a separate Rules-aware revocation mechanism.
4. Independently verify expired, disabled, forged, absent and cross-owner tokens; execute positive and **negative tests** on server handlers and Firestore rules. Capture sanitized denial responses and correlation IDs.
5. Review least-privilege IAM, secrets handling, rotation, credential access logs, session expiry and error handling.
6. Confirm recovery and **rollback** procedures without modifying production or the two original Android appointments.
7. Store immutable evidence with SHA-256, independently verify provenance and reviewer separation. Record outstanding findings, residual risks and a signed conclusion.
8. Do not close blockers or enable bookings, payments, messaging or deployment based on green CI. An independent security review and separately authorized launch decision are required.

## Phase 49.6 automated acceptance
The tests confirm only that the readiness manifest is locked to preparation mode, the seven blockers remain open, earlier evidence remains pending and GitHub Actions is read-only. They do **not** execute Firebase Admin calls, certify security, contact staging or grant authorization.
