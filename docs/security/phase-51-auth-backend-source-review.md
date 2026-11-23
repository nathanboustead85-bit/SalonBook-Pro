# Phase 51 — Source-based authentication and privileged backend review

**Status: REVIEW FINDINGS — NOT APPROVED.** Reviewed tracked repository source at branch `boustio-phase-49-3-security-verification`. No Firebase API calls, deployment, or data changes performed. All seven blockers remain OPEN.

## Direct source findings

- `app/src/main/java/com/salonbook/pro/CloudActivity.kt` uses FirebaseAuth email/password sign-in and FirebaseFirestore client SDK. It checks `user.isEmailVerified` before manual backup and restore, and places backup under `users/{auth.currentUser.uid}/backups/latest`. This is a client-side UI guard, **not** proof that server-side security rules enforce verified-owner access.
- The same Android activity offers a **Restore from Cloud** action that overwrites local `bookings`, `services` and `staff` preferences after a confirmation dialog. **Do not run restore on the existing Android installation**: two original appointments must be preserved.
- The source uses `auth.currentUser!!.uid` for the backup path. Review whether sign-out/session transitions could cause null-related failure; existing UI checks are not a substitute for backend authorization.
- A repository tree listing did not reveal a tracked Cloud Functions or Cloud Run backend directory. **Absence of tracked source does not prove no deployed backend exists**. Independently inventory staging services and IAM.
- Earlier Phase 49.3 tests model revoked/expired/forged tokens using a synthetic fixture. They do **not** establish real Firebase Admin SDK revocation, session expiry, or authorization behavior.
- The Phase 51 deny-all emulator test verifies a synthetic copy of user-provided rules, not the published staging rules revision.

## Actionable security requirements before launch

1. Independently confirm the **published** staging Firestore rules and test negative requests with synthetic accounts; keep current deny-all posture until a separately approved access design is ready.
2. Before enabling any client backup/restore, enforce verified identity and per-owner access in Firestore rules, and test cross-owner access. Keep the two original appointments outside all tests.
3. If a privileged backend is introduced, verify ID tokens with revocation checking as appropriate and enforce ownership in server handlers; Admin SDK bypasses Firestore rules.
4. Use synthetic staging-only Android test data to verify restore safety, corrupt backups, account switching, and session transitions. Never test restore against the existing two-appointment device data.
5. Independently inventory Cloud Run/Functions and IAM roles, key inventories, secret storage, audit logs, and deployment authority.

## Restrictions

No merge, deployment, billing upgrade, production changes, App Check enforcement, live bookings, payments or messaging. Independent review and explicit launch approval remain necessary.
