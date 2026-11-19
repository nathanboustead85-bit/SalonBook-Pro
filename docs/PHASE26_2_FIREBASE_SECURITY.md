# Boustio Phase 26.2 — Firebase security and access-control audit

## Scope
Isolated Auth and Firestore emulators only, with explicit `demo-boustio-phase26` project ID. Synthetic owner identities and synthetic seeded documents. Read-only repository change; **no production Firebase credentials, writes, publishing, bookings, payments or deployment**.

## Access-control matrix
- Anonymous and cross-owner access denied for private backup, live data, profile, client, appointment, booking mode, conversation and message documents.
- Unverified owner denied for verified-owner private records.
- Verified owner allowed to read own records as currently specified.
- Backend-only appointment mutations, chat messages, booking reservations, requests, locks, guard documents, onboarding drafts and completion markers denied for client SDKs.
- Frozen booking mode rejects legacy liveData booking writes.
- Published public business can be read individually, but directory listing and client-side publish/unpublish are denied.
- Unknown collection access denied by default.

## Findings requiring launch follow-up
1. **Legacy backup rule:** `/users/{userId}/backups/latest` permits an authenticated matching owner without requiring verified email. This is an existing compatibility policy; review before production approval.
2. **Public profiles:** `publicBusinesses` published records are intentionally publicly readable; audit permitted fields and personal-data exposure.
3. **Backend privilege:** Firebase Admin SDK bypasses Firestore rules. Review callable authorization, rate limits, identity validation, publishing functions and booking transactions separately.
4. **Live data:** Legacy booking uploads depend on booking mode/migration flags. Audit migration and rollback paths with isolated state transitions before enabling real bookings.
5. **Messaging:** Existing owner-only chat read rules are not a completed customer messaging architecture; voice/media security, storage rules, retention and consent still require design and testing.

## Limits
A green test proves only the enumerated emulator rule behaviours. It does not certify production IAM, deployed rule version, payment systems, Android data safety, or the live hosted website. No appointments are accessed or changed.

Next recommended milestone: Phase 26.3 server-side callable function authorization and publishing security audit, remaining non-deploying.
