# Phase 71.9.4 — Android feature parity audit
Baseline: a05dabffecd03d0b079da3388d2e514496e7b17a (Samsung 71.9.3 passed per owner).
Compared MainActivity and ManagementActivity against phase-12-23-stale-edit-guard; inspected current ClientActivity, CloudActivity and AvailabilityEngine.
| Area | Status | Evidence / next action |
|---|---|---|
| Staff schedules, breaks, leave, service assignments | Restored | ManagementActivity structured editor; owner Samsung verification |
| Client directory | Restored | ClientActivity search, edit, duplicate and integrity checks, history; owner verification |
| Draft persistence | Gap in current MainActivity | Earlier persistDraft/readPersistedDraft/clearPersistedDraft/onPause absent; inspect lifecycle and recover safely without exposing personal data |
| Appointment selection | Partial/unverified | Current bookingDialog has service/staff spinners and checkAvailability; earlier refreshBookingChoices and premiumPicker absent; inspect slot UX |
| Availability engine | Present | availableSlots/checkAvailability; verify reachable slot selection |
| Cloud recovery | Missing routes in inspected activities | Earlier showCloudBookingDifferences, previewCloudOnlyImport, showOfflineReconnectRehearsal, previewConflictRecovery, reviewPendingBookingSync and read-only diagnostics absent; recover isolated read-only previews only after security review |
| Cloud backup/restore | Present, not newly verified | CloudActivity backup/restore; do not exercise against DEV |
| Messaging/reporting/team | Partial | MainActivity feature previews; no live activation |
| Website parity | Unverified | Full website source inventory and route mapping outstanding |
## Gates
No production deployment, live bookings, payments or messaging. Preserve DEV data and signed isolated package. No claim of full parity until complete inventory, functional regression tests and Samsung verification. Do not restore historical cloud writes or stale security assumptions blindly.
