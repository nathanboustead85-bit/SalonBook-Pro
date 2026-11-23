# Phase 52.8 — Android OS backup exclusions and recovery impact

**Status:** development-branch source change only; not installed or deployed.

## Changes
The manifest now references Android legacy `fullBackupContent` and Android 12+ `dataExtractionRules` XML. Both policies exclude `sharedpref/salonbook_data.xml`, which stores local bookings, services and staff. Android 12+ rules exclude this file from **both cloud backup and device-to-device transfer**.

## Important recovery trade-off
Excluding `salonbook_data.xml` means automatic Android backup/transfer should not be relied on to restore these appointments in future APKs using these rules. This is a **data-loss/recovery trade-off**, not a completed recovery solution. Existing installed APKs are unchanged; previous OS backups may exist and are not erased by this commit. This exclusion does not guarantee that all possible app data or all backup mechanisms are covered, nor does it secure Firestore data.

Do not ship these changes until a safe, independently tested restore/recovery path exists and migration implications are reviewed. In the current development branch cloud backup and cloud restore are intentionally preview-only; there is no approved automatic recovery method.

## Evidence required
- Verify merged Android manifest and actual backup behavior on synthetic Android installations, including Android 12+ cloud and device-transfer paths.
- Inventory other local storage files and any future databases to avoid accidental inclusion.
- Validate encrypted backup, access controls, owner identity and reversible restore design using synthetic data.
- Independently review published Firebase rules, project isolation and App Check before live access.

## Hard stops
All seven launch blockers OPEN. No deployment, APK installation, live bookings, payments, messaging, IAM/rules changes, App Check enforcement or draft PR merge. Do not access or change the two original Android appointments.
