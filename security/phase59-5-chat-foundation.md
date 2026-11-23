# Phase 59.5 — Secure chat foundation (offline, not wired to production)

Implemented a reusable, **pure JavaScript** validation module at `chat/security.cjs` with strict text/attachment metadata validation, 60-second voice duration limit, image MIME and byte-size constraints, identity checks for owner and customer, and per-window message quota calculation. The automated suite tests accepted and rejected cases.

**Security boundary:** This is a foundation only. Client-provided MIME, duration, size, storage path, participant identities and recent-message timestamps are untrusted. A future trusted backend must derive identities from authenticated claims and persisted conversation membership, validate actual uploaded file bytes and voice duration server-side, reserve quotas atomically, generate storage paths, enforce Storage/Firestore rules, prevent replay and rotate anonymous-account abuse controls. This module does not itself enforce those guarantees. Do not call it from an untrusted client as a substitute for server authorization.

Current Firestore chat rules still deny all client writes and allow verified business-owner reads only. There is no live chat UI, backend messaging endpoint, customer access policy, notification delivery or deployed media storage integration in this phase. G1–G7 remain OPEN, and no Firebase deployment or Android installation was performed.
