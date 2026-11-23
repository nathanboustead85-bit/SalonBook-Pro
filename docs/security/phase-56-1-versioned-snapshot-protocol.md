# Phase 56.1 — Versioned Android snapshot architecture prototype

**Status: OFFLINE DESIGN ONLY — NOT RELEASE READY.**

The isolated `VersionedSnapshotProtocol` accepts an injected reader, reads revision-before, payload, and revision-after, and rejects missing/invalid or changed revisions. It calculates a length-prefixed SHA-256 digest to identify payload changes. This is a **checksum, not authentication**. No Android activities, SharedPreferences, Firebase, live data, or restore pathways are connected.

## Required real implementation contract
- A single coordinator must serialize **every** booking, service, staff and revision write. Every mutation must update a durable monotonic revision atomically with its payload.
- Revision must survive restart, avoid rollback and overflow, and be checked with an actual atomic snapshot mechanism. Merely reading the same revision twice does **not** exclude ABA, uncoordinated writers, torn multi-key writes or changes after capture.
- A separate staging-only app with isolated Firebase configuration and synthetic appointments must prove process-death, power-loss and rollback behavior. Durable directory fsync and authenticated/encrypted recovery files need review.
- Booking schema and owner validation must be added before integration; this prototype only enforces size and revision stability.
- Independent review and device tests are required before any real appointment capture, installation or deployment.

All seven launch gates G1–G7 remain OPEN. Original Android appointments are DO_NOT_TOUCH. Live bookings, payments, messaging, App Check enforcement and deployment remain disabled.
