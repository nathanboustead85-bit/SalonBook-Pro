# Phase 43.2 — Isolated revocation and App Check hardening

The read-only injected verifier gate models a trusted backend calling Firebase Admin verifyIdToken(idToken, **true**) to request revocation checks, then verifying an App Check token. It rejects invalid, revoked, expired, unverified, anonymous, mismatched or missing credentials; rejected/replayed App Check results; unknown verifier decisions and exceptions. Session invalidation and teardown fence late asynchronous responses.

**No trusted backend has been connected.** Test callbacks are synthetic and do not establish genuine Firebase Admin revocation, App Check enforcement, or real token provenance. The App Check contract checks the app ID is present but does not bind it to an approved app allowlist; that remains a launch blocker. No production readiness approval is given.

No original Android appointments are accessed, migrated or changed. Live bookings, payments, messaging and deployment remain disabled. No production Firebase configuration, rules or data are modified.
