# Boustio Phase 52.9 — Safe recovery design and Android data-protection review

**Decision: ANDROID SECURITY PREPARATION COMPLETE; RECOVERY NOT READY TO SHIP.** No live Firebase or Android device test is implied by this document.

## Reviewed implementation
- Phase 52.4/52.7 Android `CloudActivity.kt`: backup and restore actions are preview-only on this branch, with no local overwrite or cloud backup write. The cloud restore preview still performs a Firestore **read** under the signed-in user; actual access depends on published rules.
- Phase 52.8 Android manifest and XML: exclude `salonbook_data.xml` from Android OS cloud backup and device transfer on supported platforms. This removes a potential automatic recovery route in future builds; do not ship without an alternative.
- Phase 52.5/52.7/52.8: source checks and compilation/assembly workflows previously passed; these are not instrumented device tests or security certifications.
- Phase 52.9: adds an offline deterministic recovery-preview reference model with synthetic appointments, owner checks, schema and size checks, count comparison and SHA-256 fingerprints. Fingerprints are for comparing exact payload bytes, **not** authenticity or tamper protection.

## Proposed safe restore transaction (NOT IMPLEMENTED)
1. Select correct Firebase project and verified signed-in owner; independently validate backend access to that owner's snapshot.
2. Download versioned snapshot with immutable ID, provenance and integrity metadata; validate per-record schemas and bounded sizes.
3. Read and validate current local data. Display counts, conflict examples and an explicit warning if local bookings would be replaced.
4. Create a durable local rollback snapshot before any write; verify the rollback is readable. Define encryption and retention.
5. Require a second explicit confirmation, recheck owner/session and remote snapshot version; use atomic write/migration.
6. Re-read restored records, verify counts and hashes, then offer rollback; on any failure restore original data automatically.
7. Test account switching, concurrent writes, corrupted data, low storage, crash/restart, Android backup exclusion and device transfer with **synthetic** appointments on isolated devices.

## Remaining launch blockers
- Published staging Firestore rules revision and negative client SDK tests unverified.
- Effective IAM and service-account impersonation not independently reviewed.
- Android backup recovery design above is not implemented; OS backup exclusions may lead to unrecoverable data loss if shipped now.
- Production-vs-staging Android Firebase configuration needs explicit build-variant isolation.
- All seven existing launch blockers remain **OPEN**; no live bookings, payments, messaging, App Check enforcement or deployment.

## Handover
Treat Phase 52 as a **preparation phase**, not proof of production readiness. The next engineering step should implement a safe synthetic-data rollback prototype in an isolated environment and validate it before enabling cloud backup/restore in any distributed APK.

**Do not merge PR #5, install a new APK over the existing app, modify Firebase, or access the user's two original Android appointments.**
