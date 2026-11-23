# Boustio Phase 52.6 — Backup recovery and account isolation (offline)

**Status:** synthetic reference-policy tests, not live Firebase authorization tests and not Android runtime integration.

## Scope
- Preview-only, no local data writes.
- Reject changed account identity and unverified account.
- Reject unsupported schema, invalid JSON arrays and oversized data.
- Model explicit confirmation as necessary but **insufficient** for a destructive backup/restore write.
- Keep all writes fail-closed in the reference model until independent backend owner isolation, complete item schemas and transactional rollback are verified.

## Limitations and required work
The installed Android app is unchanged. The development-branch `CloudActivity.kt` restore is preview-only, but **cloud backup still writes** to Firestore for verified signed-in users. This Phase 52.6 reference guard does not protect that live code path. Android OS backup is also still enabled in the manifest; any backup/data-extraction policy change needs migration and recovery testing. Real cross-owner security must be enforced by published Firestore rules or trusted backend authorization, not by client checks alone.

Before production, verify actual Firebase project selection, published rules and backend IAM, test account switching using synthetic staging identities, and design non-destructive backup recovery and rollback. Do not test against the two original Android appointments.

**All seven launch blockers OPEN.** No Firebase writes, rule publishing, IAM changes, deployment, App Check enforcement, live bookings, payments, messaging or PR merge.
