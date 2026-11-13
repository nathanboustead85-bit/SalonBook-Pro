# Phase 12.27 — Backup integrity and rollback rehearsal

This phase implements an **offline in-memory simulation only**. It does not create a live backup, run a Firestore transaction, restore customer data, migrate appointments or activate online booking.

## Implemented checks
- SHA-256 checksum over exact UTF-8 JSON bytes, with a 500 KB size guard.
- Rejection of tampered, malformed, or structurally invalid backup data.
- Simulated full migration and simulated interruption after each appointment.
- Simulated rollback to preflight state when an interruption, duplicate ID or pre-existing record is encountered.
- Repeated verification that the original sealed test snapshot remains readable and unchanged.

## Important limitation
This rehearsal **does not prove actual Firestore rollback safety**. It is not a production backup or disaster-recovery implementation. Before a real migration, implement immutable backup storage, versioned migration markers, atomic write boundaries, concurrency checks, and Firebase emulator failure-injection tests. Require separate owner confirmation before touching live data.

Protected baseline: two original DEV appointments, sandbox phone zero, cloud inspection two, no migration, live bookings disabled.
