# Phase 48.3 — App Check and replay protection staging preparation

Injected synthetic App Check verifier, allowlisted app identities, consumed-token checks, expiration checks, synchronous in-process replay reservations, concurrent duplicate requests, asynchronous invalidation, credential isolation and independent approval gates. No real Firebase App Check service, credential, production project, or staging endpoint is accessed.

**Limitations:** process-local replay protection is not distributed/atomic across backend instances; caller-supplied expiry is a test precondition and is not cryptographically authenticated. Real token expiry and attestation must be independently validated by a trusted backend before any real authorization. Seven launch blockers remain OPEN. Two original Android appointments are not accessed or modified. Live bookings, payments, messaging and deployment remain disabled.
