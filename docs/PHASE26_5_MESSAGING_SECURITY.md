# Phase 26.5 — Customer messaging security and abuse prevention

## Test isolation
Directly executes actual Cloud Functions callable handlers using synthetic, in-memory Firebase Admin doubles. The GitHub Actions job has no credentials, Firebase emulator deployment, network operations or production writes. Chat starts disabled in CI; individual tests temporarily enable the flag **only within the test process** to exercise authorization and throttling paths.

## Coverage
- Anonymous Firebase identity requirement, rejecting missing or password-authenticated sessions.
- Business slug and public publication checks before starting a guest conversation.
- Guest-specific deterministic conversation IDs, duplicate-start rejection and distinct guest isolation.
- Cross-customer and cross-business message send/read denial, closed conversation restrictions.
- Per-conversation 5-second customer cooldown and 100-message quota.
- Message and customer-name validation, invalid conversation IDs, and business owner restrictions.
- Text-only persistence: supplied voice/photo/attachment properties are not stored, and no upload callable exports exist.
- Rejected callable operations cannot commit synthetic writes.

## Findings and launch gates
1. **App Check is disabled** in current chat callable configurations. Do not enable chat until App Check, abuse prevention and rate limiting are reviewed.
2. The 5-second cooldown and 100-message quota are **per conversation** and are not global IP/device abuse controls; anonymous account rotation can bypass per-conversation limits.
3. Voice messages and photo sharing are **not implemented** by this milestone. Future rollout needs authenticated upload endpoints, object ownership, media scanning/validation, size limits, retention and Firebase Storage rules.
4. Direct callable-handler doubles do not validate HTTP transport, Firebase token verification, deployed configuration or production IAM. Add true Firebase Functions emulator and adversarial concurrency testing before launch.
5. The current callable handlers ignore unrecognised attachment fields rather than rejecting the entire request; they do not persist media.
6. Existing production chat status is not verified by this audit; no environment variables, cloud services or deployments are modified.

No live messaging, bookings, payments, publishing or customer registrations enabled; existing Android appointments untouched.
