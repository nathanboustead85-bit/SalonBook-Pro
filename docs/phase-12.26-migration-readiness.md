# Boustio Phase 12.26 — Migration readiness and recovery plan

Status: **PREPARATION ONLY — NO MIGRATION AUTHORISED**.

## Protected baseline
- Original DEV Android installation: two original appointments, 09:00 and 11:30.
- Separate sandbox Android installation: zero local appointments.
- Verified-owner read-only cloud inspection: two legacy bookings, zero reported issues.
- Public/live bookings: disabled. No booking migration performed.

## Preview and safety gates
1. Reconfirm the original DEV phone appointments and read-only cloud baseline before any future migration.
2. Validate the full legacy snapshot: IDs, dates, start times, staff identifiers, durations, and overlap-free 15-minute lock slots.
3. Compare every proposed booking lock against existing locks, and check for existing shared appointments.
4. Refuse migration on missing or malformed snapshots, duplicate IDs, overlaps, existing locks, shared appointments, or incomplete comparisons.
5. Preserve an independently verifiable, access-controlled backup of the legacy snapshot **before** proposing any write operation.
6. Require a separately reviewed implementation, explicit owner consent, and tested rollback/recovery procedure before enabling writes.
7. Do not turn on live website booking as a side effect of inspecting or preparing.

## Recovery / rollback design (not implemented)
- A future migration must be idempotent, with a migration marker and a documented cutover boundary.
- Before any writes, record an immutable, owner-scoped snapshot and its checksum in protected storage.
- On a failed migration, keep public bookings disabled, prevent partial activation, and inspect both legacy and shared stores.
- Reconciliation must compare booking IDs, staff, date, time, duration and slot locks; do not overwrite either store automatically.
- Restore only after reviewing any concurrent changes and obtaining explicit confirmation. Avoid restoring the sandbox into the DEV app.
- Test failure injection and recovery in a disposable Firebase emulator environment before any live cutover.

## Phase 12.26 acceptance
- CI runs offline read-only migration safety tests.
- Tests cover valid preview, malformed/missing data, duplicate IDs, overlaps, missing staff metadata, existing locks, shared appointments and incomplete lock lookups.
- No Firebase deployment, data migration, rules changes or live booking enablement in this phase.
