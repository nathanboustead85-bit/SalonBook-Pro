# Phase 43.3 — Isolated App Check policy and backend integration preparation

This module models a future trusted backend policy, requiring Firebase Admin ID-token verification with checkRevoked=true, a verified email identity, recent auth_time, bounded expiry and issuer-provided App Check attestation from an explicit approved-app allowlist. It requires an injected atomic single-use replay-key decision and fences asynchronous responses after invalidation, teardown or expiry.

**This is not real backend enforcement.** Verifiers and replay store are injected synthetic callbacks; no Admin SDK, App Check provider, real replay database or staging environment is connected. In a real deployment, a server must derive replay keys from verified, request-bound nonces and enforce atomic consumption, expiry and appropriate App Check token-consumption semantics. Client-supplied replay keys alone cannot prevent token replay. Approved app IDs here are synthetic and do not prove app identity. App Check alone does not prevent all abuse.

The seven Phase 42.5 launch blockers remain open. Android original appointments are never accessed or migrated. No live bookings, payments, messaging, Firebase production modifications or deployment.
