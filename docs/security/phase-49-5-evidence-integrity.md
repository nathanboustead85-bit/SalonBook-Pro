# Phase 49.5 — independent evidence integrity and reviewer separation

**Preparation only. No independent verification or launch approval.**

The machine-readable evidence manifest contains seven PENDING records, no evidence claims and no approval. The validator is an isolated regression fixture for evidence formatting and integrity checks; it is not a secure approval authority or a production verifier.

## Required independent staging evidence
- Separate implementation author and reviewer; confirm identities independently and document conflict-of-interest checks.
- Exact commit, GitHub Actions run URL, UTC timestamp, staging project identity, approved test plan and negative test results.
- Hash evidence using SHA-256, validate against independently obtained original bytes, and store originals in restricted immutable storage with access audit and retention controls.
- Never store service-account keys, tokens, private customer data or raw privileged logs in public GitHub. A hash alone does not prove authenticity, independence or approval.
- Confirm Firebase Admin token revocation with checkRevoked enabled, session expiry, cross-owner server authorization, credential boundaries, and rollback in separately approved staging.
- A green CI run tests only synthetic preparation safeguards, not real staging security or production readiness.

## Fail-closed approval gate
Any missing record, digest mismatch, duplicate control, untrusted provenance, same-person reviewer, unsigned decision or missing negative result blocks approval. The candidate validation example is deliberately NOT wired to modify the launch blocker register. Seven launch blockers stay OPEN until a separately authorized, independent security review is complete.

## Non-negotiable safety
Preserve two original Android appointments. Do not modify live Firebase data or enable live bookings, payments, messaging or deployment. No production deploy, no merge of this draft PR without human review.
