# Phase 47.3 — Isolated App Check and replay protection preparation

Injected App Check verification with consume:true, approved synthetic app IDs, a bounded in-memory replay reservation and revoked Firebase ID token checks. Only synthetic owner-scoped read requests are accepted for **precheck evaluation**; access is never granted. Concurrent same-token attempts are denied within one instance. This is NOT atomic distributed replay prevention, real App Check attestation, real Admin SDK verification or staging approval. No production credentials, network connections or deployments.

All seven launch blockers remain OPEN. Original Android appointments are not accessed or changed. Live bookings, payments, messaging and deployment remain disabled.
