# Phase 10.26 — Production read-only access plan

**Status: PREPARATION ONLY. No production connection, credential, deployment or change has been made.**

## Security boundary

The existing Phase 10.25 verifier accepts an injected Firestore client. Its booleans and `authenticatedUid` are caller-supplied and **are not proof of authentication or IAM permissions**. Do not expose this verifier as a public callable, website endpoint or unrestricted GitHub Actions job. A successful unit/emulator test is not a production check.

Before a real production read, an operator must independently establish:

1. **Identity**: sign in through Google Cloud using a trusted operator identity; establish the business owner UID from authenticated Firebase records rather than an unverified form field.
2. **Scope**: grant only the minimum Firestore/Datastore read permissions needed for the following paths. Use a dedicated short-lived operator identity; avoid long-lived service-account keys and avoid storing credentials or archived customer data in GitHub.
3. **Target**: confirm the actual Firestore client project is `salonbook-pro-ad5ff`, not merely a project ID string passed to the verifier. A forged string is not sufficient.
4. **Archive**: provide the locally verified 10-booking archive privately, with its source path and SHA-256 matching the owner. Never commit the archive or print its customer data in logs.
5. **Authorisation**: obtain explicit approval to perform a **read-only production verification**. This does not authorise any booking-mode initialisation, freezing, deletion, migration, or public booking activation.
6. **Output**: return only the redacted readiness status, count and hash; never print customer data, Firebase tokens or full document snapshots.

### Required read paths

- `users/{ownerUid}/liveData/bookings` — cloud legacy booking JSON
- `businesses/{ownerUid}/settings/bookingMode` — booking mode
- `businesses/{ownerUid}/migrations/android-bookings-v1` — migration marker
- `businesses/{ownerUid}/appointments` — collection emptiness
- `businesses/{ownerUid}/bookingLocks` — collection emptiness

Firestore security rules are **not** an IAM restriction for Admin SDK/service-account access. A service account with write permissions could still write even if application code currently only reads. A narrowly scoped read-only IAM role is essential; test effective permissions independently before production use.

### Explicitly prohibited during this phase

- No GitHub secrets, private keys or archive files added to the repository.
- No production workflow, Cloud Function or public API deployed.
- No `set`, `create`, `update`, `delete`, batch writes or transactions.
- No changes to production booking mode, legacy bookings, migrations, appointments, locks or security rules.

### Completion criteria

A future separately approved production read is complete only when the trusted operator confirms actual project and effective read-only IAM, verifies all five live paths, and records a redacted report. Until then, **production readiness is unverified**.

The next implementation step is an authenticated operator-only execution path, preferably short-lived and locally initiated, with no credentials in the repository. It must verify the actual connected project and permissions, rather than trusting the caller's flags.
