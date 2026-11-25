# Phase 65.8 — customer management foundation audit

Scope: offline Kotlin previews, not production authorization or persistence. Sections 65.1–65.7 cover profile read/edit, history, notes, search, duplicate preview and privacy request planning. Combined regression tests use synthetic records only. No live deployment or migration approved.

## Open integration requirements
- Derive owner and employee identity from authenticated backend sessions; enforce tenant and field-level permissions, revocation and audit logging. Caller-supplied IDs and verified flags are not authoritative.
- Atomic revision checks and writes, concurrency, idempotency, backup/restore and cross-device tests. Existing pure edit proposals do not persist or prevent concurrent commits.
- Validate stored records and referenced staff/service IDs, contact ownership and normalization; syntax checks are not verification. History uses caller-supplied clock and status; validate authoritative timestamps/status and handle legacy IDs. Search needs server-side scoped pagination, indexes, rate limits and stable snapshots; current 10,000-record limit is preview only.
- Notes require access minimization, retention and safe rendering; do not log sensitive text. Duplicate matching is heuristic, including shared contact details; no automatic merge. Require verified identity, explicit review, atomic reassignment of all references, consent reconciliation, audit and recovery before enabling merges.
- Privacy request flags and retention review are caller supplied. Export preview returns profile only, not complete subject access data. Require verified request intake, full data inventory, secure delivery, retention/legal review, deletion/anonymization and backup lifecycle, deadlines and audit. No GDPR compliance claim.
- Wire Android and web interfaces, employee permissions and PWA requirements; independent staging/security verification and all existing launch blockers remain open.

## Samsung final verification
Install signed isolated APK as update without uninstalling or clearing storage. Verify TEST opens, existing TEST client records and contact details remain unchanged, Client Data Integrity Check opens, dashboard/calendar layout works, no unexpected notifications. Separately open DEV 11.13 and verify both original appointments remain intact; do not restore or transfer data. TEST has no internet permission and is not expected to sign in or contain DEV records. No live customer features are approved by these checks.
