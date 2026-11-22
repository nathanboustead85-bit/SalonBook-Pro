# Phase 40.3 — Business hours and shared revision contract (isolated only)

The inspected Android v1 source stores three separate owner-scoped documents at `users/{uid}/business/profile`, `users/{uid}/liveData/services`, and `users/{uid}/liveData/staff`. It validates staff weekly schedules, **not** business-wide opening hours, and has **no** shared revision field. See `web/phase34/android-firestore-map-34-2.js` and `web/phase39/android-compatibility-39-4.js`.

This phase adds a **proposed v2 validation contract only**: a seven-day business opening-hours map, each day containing zero to three non-overlapping chronological periods with strict HH:MM times; three owner-matched, schema-v2 envelopes with identical positive integer `sharedRevision` and identical `snapshotId`. Missing/extra days, malformed periods, mixed owners, mixed revisions, unsupported versions, and malformed snapshot IDs fail closed.

No new Firestore documents or schema migrations are written. The contract does **not** establish atomicity across devices, verify staff availability, authorize bookings, or approve a v1-to-v2 migration. The synthetic emulator regression confirms existing Android v1 records stay explicitly non-migration-ready, while Firestore rules deny cross-owner and unverified reads.

**Next:** Phase 40.4 session/revocation and recovery hardening. Independent staging review, rollback design and approval remain mandatory before production use. The two original Android appointments are never read, modified, deleted or migrated. Live bookings, payments, messaging and deployment remain disabled.
