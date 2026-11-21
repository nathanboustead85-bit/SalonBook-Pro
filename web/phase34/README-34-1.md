# Phase 34.1 — Isolated read-only Firebase gateway foundation

An injected, explicitly **isolated test-only** asynchronous document reader for an owner-scoped dashboard. It validates a verified principal and expiration, constructs three fixed owner-scoped paths, rejects missing/mismatched owner documents, stale/future timestamps, and mixed revisions, and fails closed on read errors. It never reads bookings and has no mutation methods.

**This is not yet a real Firebase SDK integration or a working production dashboard.** It does not initialize Firebase, access any live Firestore project, use credentials, perform deployment, or alter Android appointments. The document shape, path for the business profile, revision semantics, and trusted auth envelope are provisional and must be reconciled with actual Firestore schemas/rules before a real emulator adapter. In particular, an arbitrary injected adapter cannot by itself prove backend read-only authorization: real server-side rules and trusted identity verification remain mandatory. Shallow-frozen document data is not a security boundary.

Next: inspect actual business profile path and stored schema, add an isolated Firebase emulator read-only adapter, test denial against Firestore rules, and only later consider separately approved real read-only integration.
