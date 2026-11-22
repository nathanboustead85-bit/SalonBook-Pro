# Phase 39.4 — Android/browser compatibility and migration-readiness assessment

Read-only isolated validation of the inspected Android v1 profile, services and staff Firestore documents. Requires exact schemaVersion 1, current timestamps, verified owner, well-formed staff JSON, valid staff weekly working periods and breaks without overlap. The existing strict Phase 33 mapper additionally validates time-off and staff service references. All unsupported/malformed records fail closed.

**Important distinction:** staff weekly hours are validated; business-wide opening hours are NOT proven by this Android schema. No shared revision is present. Neither live availability nor migration readiness can be inferred from these records. The module explicitly reports `businessOpeningHoursStatus: NOT_VERIFIED`, `availabilityStatus: UNVERIFIED_READ_ONLY`, `migrationReady: false` and `sharedRevisionVerified: false`.

Migration blockers (P0): inspect actual business-wide opening-hours schema without accessing production; define a versioned cross-device revision and atomic migration/rollback contract; review old Android bookings preservation and backups; verify staging cross-device parity with synthetic accounts; obtain explicit production authorization. No migration is attempted.

Unit and Firebase emulator tests use synthetic data only. No public dashboard wiring, production rules, booking/payment/messaging activation, deployment or original Android appointment access.
