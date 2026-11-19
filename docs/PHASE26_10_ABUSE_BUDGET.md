# Boustio Phase 26.10 — Cross-account abuse budget prototype

A **server-side Firestore transaction module** is introduced at `functions/chatAbuseBudget.js`. It is deliberately **not connected to the live chat callable functions**. The module applies hourly identity, business-wide and optional privacy-preserving risk-signal budgets, with atomic all-or-nothing increments. This provides a foundation for mitigating account rotation but is not a complete prevention system.

## Critical limitations
- A fresh anonymous UID can evade identity-specific quotas. Business-wide limits cap aggregate volume, and optional trusted signals can correlate activity, but neither proves unique human identity.
- Risk signals must come from a trustworthy, privacy-reviewed backend; never trust client-supplied signals or persist raw IPs.
- The module does not yet have emulator concurrency tests or production integration. CI here runs source and validation checks only.
- App Check remains disabled in existing chat callables. Configure attestation and validate on staging Android/web clients before any live activation.
- Firestore document TTL cleanup must be configured if this module is integrated; `expiresAtMs` is metadata, not an automatic TTL policy.
- Evaluate business-wide caps for denial-of-service effects on legitimate customers; add monitoring and appeals.

## Next release gates
Connect the module behind a disabled feature flag in staging, add emulator transaction contention tests, integrate server-trusted risk signals, verify App Check and authenticated callable transport, and obtain explicit deployment approval.

**No production deployment, booking changes, attachment enablement, or live messaging.**
