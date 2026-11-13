# Phase 12.42 — Trusted availability publication (emulator only)

Implements an isolated backend test pipeline:
1. Trusted Firebase Admin reads private owner-side test fixture documents from `phase1242Private/{businessId}/source/{profile|services|staff|appointments}`.
2. The existing Phase 12.40 projection calculates per-staff free start times and strips customer/private source fields.
3. Trusted Admin writes the sanitized result to `phase1241PublicAvailability/{businessId}` with a transaction preventing older generations from overwriting newer ones.
4. Emulator security rules allow public document `get` only, and deny all client listing/writes and all private source reads.

This is **not deployed** and does not read real owner `liveData` records. The test rejects non-demo projects and non-local emulator hosts. The workflow has no production credentials.

**Important remaining gap:** If a business is unpublished or source data becomes invalid, the pipeline currently refuses to publish but **does not revoke an existing snapshot**. Public rules do not enforce freshness. This must be fixed before any production rollout, with a server-controlled expiry/revocation process. Also validate timezone/DST, real Android schema, refresh scheduling, authorization, public read quotas, and release controls.

No customer booking creation, production Firestore rules, hosting or original Android appointments are changed.
