# Boustio Phase 49.7 — final independent security review preparation

**Review NOT STARTED. No security certification, staging execution, blocker closure, release or deployment is authorized.**

## Current evidence
Phase 49.3–49.6 CI tests validate synthetic emulator security, evidence-format guards and staging preparation safeguards. They do not prove real Firebase Admin SDK revocation, actual staging backend owner authorization, or live-system security. All seven launch blockers remain OPEN; evidence remains PENDING.

## Independent reviewer handoff
1. Assign an **independent reviewer** different from the implementation author; record independence, conflict-of-interest check, qualifications and authorization.
2. Obtain separate owner approval before any isolated staging test. Confirm project ID, least-privilege IAM, secrets separation, data isolation and approved synthetic test accounts.
3. Independently test `revokeRefreshTokens` and backend `verifyIdToken(token, true)` with revocation checks enabled; test disabled, expired, forged and missing tokens. Document Firestore token revocation limitations.
4. Test owner isolation at the Firestore Rules boundary and server handlers; **Admin SDK bypasses Firestore Rules** so handlers require independent authorization.
5. Verify negative cases, concurrency/abuse boundaries, credential leakage prevention, logging, session expiry and **rollback**.
6. Record commit SHA, CI run URLs, UTC timestamps, redacted evidence digests, immutable restricted evidence storage, findings, remediation and signed conclusions. A green GitHub Actions check is not independent approval.
7. Record a separate evidence package and authorized decision for each of the **seven launch blockers**. No blocker may close automatically.

## Outstanding risks
R1 — real staging Admin SDK revocation not tested independently.
R2 — independent backend owner-isolation proof missing.
R3 — independent staging isolation and least-privilege credential audit missing.
R4 — real session expiry and negative security cases unverified.
R5 — independent evidence provenance, signoff and rollback proof missing.

## Safety
Preserve the **two original Android appointments**. Do not modify production Firebase, live bookings, payments, messaging, Android data or deployment. The review package is preparatory only and remains on a draft PR branch pending human review.
