# Phase 27.9 — Isolated Firestore TTL-ready schema v2

This phase introduces an **emulator-only** budget record writer in `chatAbuseBudgetsV2/{bucket}/{kind}/{hashedId}`. Records include `schemaVersion:2`, Firestore-native `createdAt` and `expiresAt` timestamps, numeric `expiresAtMs` for comparison, and a counter. Tests exercise real Firestore emulator writes, duplicate protection, collection isolation and booking preservation.

**No migration:** The v2 writer is not imported by production Cloud Functions, cannot run unless its project ID begins `demo-boustio-`, and uses a separate collection. It is not a production counter replacement. The prototype rejects duplicates rather than incrementing counts; it is unsuitable for live rate limiting.

**Critical TTL caveat:** Nested collection-group IDs such as `identity`, `business` and `signal` can exist in other parts of a Firestore database. Applying a managed TTL policy to a collection group requires an inventory of *all* documents in that group and a verified field-specific impact assessment. This code configures **no managed TTL policy**. A future production design should use uniquely named subcollection groups or a dedicated top-level collection before TTL rollout.

The expiry uses the existing two-hour-window formula and is not yet a fully reviewed 48-hour retention policy. Phase 27.5's proposed 48-hour maximum is a ceiling, not an assertion of actual lifetime.

No production deployment, real booking access, live messaging activation, or live data migration.
