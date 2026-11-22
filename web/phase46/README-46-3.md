# Phase 46.3 — Isolated App Check and replay-prevention preparation

An injected **synthetic** App Check verification contract checks an explicitly approved app ID, calls `verifyToken(token,{consume:true})`, rejects already-consumed and mismatched tokens, and reserves each token synchronously before awaiting verification to reject simultaneous replay. Invalidations reject stale responses. Credential boundary checks and a bounded replay cache fail closed.

**Security limitation:** the token reservation is only in-memory, per instance; it is not atomic distributed replay prevention, and cannot protect multiple backend workers or restarts. This module does not initialize Firebase Admin, validate real attestation, grant any access, use real credentials, or deploy. The injected verifier is a test double, not evidence of genuine App Check. All seven launch blockers remain OPEN, including real attestation and atomic replay verification.

Only synthetic Firestore emulator fixtures are used in tests. Original Android appointments, production data and rules are not accessed or modified. Live bookings, payments, messaging and deployment remain disabled.
