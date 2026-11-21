# Phase 34.2 — Inspected Android/Firestore source schema and offline mapping

## Actual source findings (development branch)
- `firestore.rules` lines 142–210: private profile **users/{uid}/business/profile**, verified-owner read; `businessId`, `name`, `slug`, `category`, `email`, `phone`, `address`, `description`, `acceptingBookings`, `schemaVersion`, `updatedAt`; booking acceptance must be false on writes.
- `firestore.rules` lines 76–112: `users/{uid}/liveData/services` and `staff`, verified-owner reads, `json` string, `schemaVersion=1`, `updatedAt` timestamp. Rules do not parse JSON or enforce a shared revision.
- `CloudSyncManager.kt` lines 35–78: Android uploads services/staff as JSON arrays in the same `liveData` documents, server timestamp.
- `ManagementActivity.kt` lines 1170–1235 and 1310–1355: staff schedule is per-staff `weeklySchedule`, `weeklyBreaks`, `timeOff`, `serviceIds`, `role`, `publicVisible`; services have string `price` and integer `duration`.
- No verified Firestore business-wide opening-hours document or shared revision field established by these inspected sources.

## Implementation
`android-firestore-map-34-2.js` maps only **already supplied, owner-authorized** documents into an offline, read-only display subset. It does not call Firestore, parse bookings, or modify data. It does not claim the Phase 34.1 provisional `businesses/{uid}` path or shared revisions match production. Staff full schedule semantics require separate schema validation before availability calculations.

## Launch blockers
Phase 34.1's provisional gateway path `businesses/{uid}` and shared revision assumption must be replaced or reconciled with the actual `users/{uid}/business/profile` and independent timestamps before any real SDK adapter. Verify timestamp semantics, security rules in an isolated emulator, complete staff validation and business-wide hours source. No live connection or deployment approved.
