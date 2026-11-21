# Boustio Phase 31.3 — Freshness, version and recovery contract

This is a **pure offline validator** around the Phase 31.2 published-profile/catalogue mapping. It does not fetch, store, publish or authenticate data. The input envelope is **proposed staging metadata**, not an assertion that current Firestore documents contain these fields.

An authorized publisher must eventually provide a coherent envelope with `schemaVersion:1`, `catalogueVersion:1`, integer `revision>=1`, matching `profileRevision` and `catalogueRevision`, millisecond `generatedAt`, `profile` and `catalogue`. The public profile and catalogue must still satisfy the existing Phase 31.2 contract. Explicit caller-provided `now` is mandatory. Default maximum age is five minutes; configurable maximum is one hour.

Future timestamps, expired snapshots, unsupported versions, mismatched revisions, invalid records, cross-business identities and missing records fail closed with `UNAVAILABLE`. Recovery requires a fresh valid snapshot with a **strictly increasing revision**. There is no stale cache fallback and no silent automatic retries. This is not a security boundary: the eventual authorized publisher must enforce access control, atomic versioning and monotonic revisions server-side. A browser-supplied revision is not trustworthy.

No Android files, original appointments, Firestore rules, live bookings, payments, messaging or deployment are changed. No production Firebase integration is claimed.
