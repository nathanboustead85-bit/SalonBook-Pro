# Phase 57.6 — Backup and legacy booking compatibility

**Local emulator regression only. No changes to firestore.rules or Firebase Console.**

This phase tests the *current* published-rule copy and documents potentially safer alternatives. Tests intentionally confirm two existing permissive behaviors rather than misrepresenting them as fixed: unverified owner backup overwrites and legacy booking writes when booking mode is missing. Both require explicit product and security decisions.

## Hardening proposals (not applied)
- **H1:** Require email verification and enforce a validated, size-bounded, versioned backup schema. First inspect Android backup/restore formats and recovery behavior; changing this without compatibility work may strand backups.
- **H2:** Change legacy booking eligibility from missing-or-legacy booking mode to explicit legacy mode, after independently verifying the migration state and preserving rollback paths.
- **H3:** Review public business document fields and remove sensitive fields from the public publication pipeline.

## Acceptance before production changes
- Test actual Android app read/write compatibility with synthetic backups.
- Test migration and rollback on disposable staging accounts and emulator, including process interruption.
- Compare repository and deployed rules; obtain independent security review and explicit authorization.
- Do not alter either original Android appointment.

**G1–G7 OPEN. No deployment, payments, live bookings, messaging, App Check enforcement, or live Firebase writes.**
