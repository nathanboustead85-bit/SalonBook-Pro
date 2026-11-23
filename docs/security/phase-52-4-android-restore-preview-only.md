# Boustio Phase 52.4 — Android restore preview-only hardening

**Change:** In the development branch only, the existing Android `CloudActivity.kt` restore action now fetches a cloud backup and shows counts, but **does not write local bookings, services or staff**. The button and dialog are renamed Preview. The Firestore document path takes a captured UID rather than dereferencing `currentUser!!`; the async restore callback checks account identity and verified state before displaying backup contents. Backup version, array syntax and 1 MB per-array string limits are checked.

**Important:** This intentionally suspends restore functionality in builds made from this branch. Existing installed APKs are unchanged. A preview is not a full integrity/schema check. The cloud **backup write** action remains available in code and still requires verified email; no real Firebase operation was executed in this phase.

**Testing:** Source-based regression assertions run in GitHub Actions. These are not instrumented Android tests and do not prove a successful APK build or live Firebase behavior. Before shipping, run Android compilation and synthetic-device tests, then design transactional restore with verified ownership, preview and rollback. Never run restore/backup tests on the existing device holding the two original appointments.

**Restrictions:** All seven launch gates OPEN. No production or staging deployment, no App Check enforcement, Firebase rules/IAM changes, payment, messaging, live bookings, or PR merge.
