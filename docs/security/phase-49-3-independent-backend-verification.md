# Phase 49.3 — Independent backend security verification preparation

Status: PREPARATION ONLY — NOT INDEPENDENTLY VERIFIED; all seven launch blockers OPEN.

## Mandatory safety boundaries
- No production Firebase calls, credentials, deployments, migrations, or writes.
- Preserve the two original Android appointments. Tests use synthetic emulator-only identities and records.
- Live bookings, payments, messaging and deployment remain DISABLED.
- This document does not grant approval to close any launch blocker.

## Independent verifier requirements
Verifier must not be the implementing author. Record verifier identity, affiliation, date/time UTC, commit SHA, Firebase emulator/tool versions, exact commands, immutable workflow run URL, test outputs, negative cases, and signed conclusion. Redact tokens, PII and credentials. Store evidence in a restricted location with retention/access policy; link only sanitized summaries from public GitHub.

## Firebase Admin revocation procedures (staging only; never production)
1. Provision isolated staging Firebase project with two synthetic users A/B, least-privilege verifier access, separate credentials and explicit owner approval.
2. Obtain A ID token; verify a server endpoint checks `verifyIdToken(idToken, true)` (revocation check enabled), not merely decoded JWT or `verifyIdToken(idToken)`.
3. Call `revokeRefreshTokens(A.uid)` with staging-only privileged test operator; ensure newly issued tokens require reauthentication and previously issued token is rejected by revocation-aware backend. Capture HTTP status, UTC timestamps and redacted request correlation IDs.
4. Repeat for disabled user, expired token, forged token, missing token and B's valid token against A's resources. All must fail closed where appropriate; B must never access A.
5. Verify refresh-token revocation is NOT assumed to invalidate already-issued Firestore client ID tokens immediately. Where Firestore Rules enforce revocation, verify a separately maintained and protected revocation timestamp/metadata design and its latency; otherwise document the residual risk and wait for token expiry. Do not claim emulator tests prove production Admin SDK revocation semantics.
6. Test session expiry using an injected clock in unit tests; in staging verify actual token expiration and backend rejection. Do not alter system clocks or real accounts.
7. Independent verifier reviews IAM and service-account permissions, secrets/CI exposure, Admin SDK server-only boundaries, owner scoping, audit logging, emergency credential rotation, and access revocation.
8. Keep all launch blockers OPEN pending real staging evidence and explicit independent signoff.

## Owner isolation and credential boundaries
- Anonymous, user A and user B: reads/writes on each other's private business, booking, client, backup and message paths must be denied.
- Admin SDK bypasses Firestore Rules: server handlers MUST validate authenticated user, resource ownership, authorization and input, rather than trusting client-supplied owner IDs.
- No service-account JSON, Firebase Admin private key, refresh token, or privileged CI secret in client bundles, logs, public artifacts or repository.
- Default CI token permission is contents:read; no production deployment permissions or secrets.

## Evidence matrix (all initially PENDING)
| Control | Independent evidence required | Status |
| --- | --- | --- |
| Revoked tokens | Staging Admin revocation and backend denial | PENDING |
| Disabled/expired sessions | Time-stamped negative tests | PENDING |
| Cross-owner isolation | Rules emulator plus backend staging tests | PENDING |
| Privileged credential boundaries | Independent IAM/secret audit | PENDING |
| Session and token validation | Code review and negative tests | PENDING |
| Seven launch blockers | Separate evidence and approval for each | OPEN (7/7) |
| Existing Android data | Explicit non-modification confirmation | PROTECTED / NOT TOUCHED |

## Acceptance gates
Automated checks are preparatory and are NOT an independent security certification. Require two-person review, staging isolation proof, verified negative tests, secure evidence storage, rollback plan and formal approval before changing any launch blocker. Never automatically enable bookings, payments, messaging or deployment.
