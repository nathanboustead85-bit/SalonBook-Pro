# Phase 17.4: live Firebase metadata-only verification

This workflow is **not enabled automatically**. It is a separate, manually dispatched GitHub Actions workflow. The regular Samsung preview workflow only checks its safety contract and never contacts live Firebase.

## Required one-time setup

1. In GitHub, create an environment named `boustio-readonly-verification` with required reviewer approval and restrict it to the `milestone-customer-booking-experience` branch. A reviewer must approve each run. Do not set up a reviewer if your GitHub plan/repository settings do not support it; keep the live workflow unconfigured instead.
2. In Google Cloud, configure GitHub OIDC Workload Identity Federation, restricted to this exact repository and the environment. Create a **dedicated service account** with only the minimum Firestore read permissions needed for the three document paths. Do not reuse the deployment or Firebase Admin service account. **Do not grant Datastore Owner, Editor, or any write-capable role.** IAM permissions may need a custom read-only role; verify with a Google Cloud administrator.
3. Add environment variables `BOUSTIO_WIF_PROVIDER`, `BOUSTIO_READONLY_SERVICE_ACCOUNT`, and `BOUSTIO_FIREBASE_PROJECT_ID` to the GitHub environment.
4. Add environment secret `BOUSTIO_FIREBASE_OWNER_ID` with the business owner's Firebase UID. Never print this value.
5. Only after reviewing permissions and backup state, manually run **Boustio Phase 17.4 Controlled Live Firebase Read-only Check** and enter `VERIFY_READ_ONLY`. Review the environment approval prompt.

The script only checks whether `publicBusinesses/{ownerId}`, `users/{ownerId}/liveData/staff`, and `users/{ownerId}/liveData/bookings` exist. It reports only a status and a count, not booking contents. It does **not** verify booking consistency, count appointments, or prove production readiness. A missing document is reported as a failure and must be investigated without editing live data.

The workflow cannot create bookings through its code. **Enforce read-only permissions in Google Cloud IAM** as the independent safeguard. No public booking endpoint is enabled. Do not run until the service account's effective permissions have been verified.
