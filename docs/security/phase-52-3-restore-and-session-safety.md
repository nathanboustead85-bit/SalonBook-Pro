# Phase 52.3 — Synthetic cloud restore and session safety

**Status:** offline reference tests only; not integrated into the Android APK.

## Verified source risk

The existing Android `CloudActivity.kt` checks `isEmailVerified` and that three payloads parse as JSON arrays, then commits the restored values to `salonbook_data` preferences. `backupDocument()` uses `auth.currentUser!!.uid` when called, so identity may be re-evaluated after an asynchronous operation or session change. The restore currently lacks explicit schemaVersion validation, detailed content validation, a preview of what will change, and rollback protection. The restore operation can replace the local bookings/services/staff; **do not run it on the user's existing Samsung installation**.

## Phase 52.3 implemented

Added `security/phase523-restore-guard.cjs` and synthetic Node tests to demonstrate fail-closed schema checks, identity matching and a non-mutating preview. This is a **proposed design model**, not a claim that Android restore is fixed. These tests do not connect to Firebase, write Android preferences, or inspect the two original appointments.

## Required before Android integration

- Design an Android/Kotlin equivalent with explicit session identity capture and recheck.
- Review Firebase backend ownership enforcement and rules independently.
- Specify valid booking/service/staff item schemas and maximum record counts (not just arrays).
- Provide an atomic backup/rollback strategy and user-facing preview; test only with synthetic isolated installations.
- Independently verify release build environment and published Firestore rules.

**All seven launch blockers remain OPEN.** No deployment, merge, live bookings, payments, messaging, App Check enforcement, Firebase rule or IAM changes.
