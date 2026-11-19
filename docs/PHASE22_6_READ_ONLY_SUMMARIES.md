# Phase 22.6 — Secure read-only service and staff data presentation

**Committed; CI verification pending. NO-GO for deployment.**

Added an isolated, opt-in dashboard summary controller reading only `/users/{verifiedOwnerUid}/liveData/services` and `/users/{verifiedOwnerUid}/liveData/staff` through Firebase browser SDK snapshot listeners. These are the existing owner-scoped Firestore paths. The stored `json` must be schemaVersion 1 and contain an array or an `items` array; unknown formats are shown as unavailable rather than guessed. The UI renders names with textContent, never HTML. Lists are cleared and listeners unsubscribed on sign-out, invalid/unverified session or owner change. Cache-only snapshots are not trusted.

The existing premium teal-and-white isolated test fixture now shows read-only service and staff names and counts. The 15 earlier Chromium tests are retained and five new tests cover verified owner data, unverified denial, sign-out clearing, cross-owner separation and HTML injection resistance. Tests run against isolated Auth and Firestore emulators using the synthetic demo project only.

**Not implemented:** production data migration, schema adaptation beyond the strict supported shape, service/staff editing, public registration, customer bookings, live dashboard activation, deployment or Android appointment changes. All live activation flags remain false.

**Acceptance:** 20/20 browser tests passing in GitHub Actions. Do not mark complete before verifying logs.
