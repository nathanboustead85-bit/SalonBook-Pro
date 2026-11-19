# Phase 27.7 — Firebase TTL migration planning (offline)

This phase adds an **offline, read-only migration planner** and 17 tests. It validates a legacy numeric `expiresAtMs` plus `createdAtMs` against the Phase 27.5 retention limits and calculates Firestore timestamp seconds/nanoseconds for a future `expiresAt` field. It rejects unsupported collections, missing provenance, malformed times, overly long retention, and existing timestamp values rather than overwriting them.

**Important:** This does not perform migration, set TTL policies, connect to production Firebase, deploy, or enable messaging. Managed Firestore TTL must be configured separately on the timestamp field, with a staging verification plan, privacy review, and explicit user authorization.

**Schema audit required before any migration:** Existing abuse budget documents may not store `createdAtMs`; these are intentionally blocked until trustworthy server-side creation metadata is available. Existing budget counters may be nested in paths rather than the illustrative collection IDs. Confirm actual document paths, parent/subcollection behavior, expiry fields and retention requirements before any live migration. Firestore TTL deletion is asynchronous, not instantaneous. No user appointments are changed.

Next: inspect actual budget document schema and paths and write emulator-only migration integration tests. Do not interpret an offline test pass as production TTL readiness.
