# Secure cross-device synchronisation architecture

Proposed contract, not a deployed backend. Firebase is the intended backend; existing rules and callable functions must be reconciled before implementation.

Android and business web use authenticated tenant-scoped reads and server-authorized commands. Customer web reads a minimal published projection and requests availability through a server endpoint. No direct customer access to private staff schedules, customer records or appointment lists. Never trust client-supplied role, tenant, duration, price or availability.

Booking commands require server-side membership or verified customer authorization, idempotency key, expected revision for edits, server-calculated duration and an atomic conflict check covering the entire interval. A transaction must contend on shared staff/date occupancy records; merely querying appointments then writing a new document is insufficient. Cancellation and rescheduling must update occupancy atomically. Time zone is business-defined IANA zone; store UTC instants and preserve local scheduling intent, explicitly handle DST ambiguity.

Offline reads may use tenant-scoped cache; queued commands are pending, never confirmed. On reconnect reauthorize, replay idempotently and reject stale revisions. Clear private caches on sign-out or tenant change. No automatic migration of existing DEV records: dry run, explicit approval, backup, reconciliation and rollback plan required.

Proposed next steps: 72.2 existing backend/schema inventory; 72.3 tenant authorization; 72.4 atomic booking commands; 72.5 Android adapter; 72.6 business web adapter; 72.7 customer booking adapter; 72.8 offline and migration; 72.9 cross-device emulator tests; 72.10 staging readiness audit. Sequence subject to findings. All production gates remain open.
