# Phase 53.1 — Isolated Kotlin recovery and rollback prototype

**Implementation:** `app/src/main/java/com/salonbook/pro/RecoveryTransaction.kt` introduces an injected `RecoveryStore`, a snapshot of bookings/services/staff, and a transaction that saves the original snapshot in memory, validates original and incoming data via a supplied validator, writes the incoming snapshot, reads it back, and attempts to restore and verify the original snapshot on any write or verification error.

**Scope limit:** This is a **prototype**, not an atomic or durable recovery implementation. The store is injected, no real Android preferences or Firebase are accessed, and `CloudActivity` does not call this class. The code does not guarantee recovery after process death, storage corruption, power loss, or a second failure during rollback. The validation callback is intentionally not a full schema validator. A production solution must first persist an encrypted rollback journal, validate ownership and schema, and handle interrupted writes.

**Testing:** GitHub Actions compiles release Kotlin and executes offline source guards. These source guards do not execute Kotlin runtime failure injection. Runtime tests of partial write, verification mismatch, rollback write failure and process restart remain required before integrating.

**Restrictions:** All seven launch gates OPEN. No APK installation, deployment, Firebase changes, live bookings/payments/messaging, App Check enforcement, PR merge, or access to the two original Android appointments.
