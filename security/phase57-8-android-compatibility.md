# Phase 57.8 — Android backup compatibility findings

## Inspected source
`app/src/main/java/com/salonbook/pro/CloudActivity.kt` was inspected directly in the repository.

The `restore()` preview reads `schemaVersion` as a long, then `bookings`, `services` and `staff` as strings and validates each as a JSON array. The `backup()` path currently previews locally stored strings and counts, without uploading a Firestore backup. The `restore()` path fetches a server backup but does not write local preferences.

## Candidate incompatibility
The Phase 57.7 candidate requires only `json`, `schemaVersion` and `updatedAt`. The Android restore preview expects `bookings`, `services`, `staff` and `schemaVersion`. An Android-shaped document is rejected by the candidate. A candidate-shaped document cannot be interpreted by this Android restore preview.

**Do not deploy the candidate.** Compatibility with historical backup documents, any other app backup implementations, and real Android versions remains unverified.

## Recommended next design
Define a versioned envelope retaining the three Android JSON-array fields with bounded lengths, verified-owner access and explicit timestamps; test synthetic old/new data and rollback. Review any other backup readers/writers and migration requirements first. Keep live Firebase and original appointments untouched.

All G1–G7 remain OPEN. No deployment, live bookings, payments, messaging or App Check enforcement.
