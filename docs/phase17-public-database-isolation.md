# Boustio Phase 17 — isolated public catalogue database (design gate)

Status: **PREPARATION ONLY**. No Firestore database creation, IAM changes, deployments or data migration are authorised by this document.

## Security goal
Keep existing private appointments, backups, client profiles and owner data in Firestore `(default)`. Put publicly readable business listings, slug reservations and catalogue projections in a **separate named Firestore database** (proposed ID: `boustio-public`, pending availability and approval).

## Current architecture and blocker
`functions/index.js` currently initialises one Admin Firestore client with `getFirestore()`. `publishBusiness` reads `users/{uid}/business/profile` and transactionally writes `publicBusinesses/{uid}`, `businessSlugs/{slug}` and `publicSlugMappings/{slug}` in the same default database. `unpublishBusiness` updates public data in the same database. Other handlers also read these collections.

Firestore transactions are confined to a single database. Moving only the public writes to another database **without redesign** would break atomicity and slug collision protection. The existing publisher runtime also still needs private profile access, so simply introducing a public database does **not** eliminate its private-data privilege.

## Proposed implementation sequence (no live actions)
1. Inventory every function, website route, Firestore rule, index and test referencing publicBusinesses, businessSlugs, publicSlugMappings or public catalogue collections.
2. Design an explicit **private-data reader** and **public-database writer** trust boundary. A private-side verified-owner service prepares a minimal allowlisted publication payload; the public-side service validates provenance and writes only public records. Neither service should be allowed to read/write both databases by default.
3. Preserve slug uniqueness using a transaction entirely within the public database. Define an idempotency key, replay protection, stale-version checks, retries and recovery for failures between private read and public write. Avoid promising cross-database atomicity.
4. Define the least-privilege IAM conditions for the actual database resource names, verify effective permissions in a non-production test, and confirm that neither identity can access private bookings or backups outside its intended role. Firebase Security Rules do not restrict Admin SDK access.
5. Add emulator/unit integration tests for ownership, impersonation, slug collisions, rename, unpublish, retry, concurrent publish, stale events, partial failure, data minimisation and disabled bookings.
6. Prepare read-only preflight checks and a separate deployment approval gate. Creating the database, applying IAM, migrating records, deploying functions, and enabling customer access require **separate explicit approval**.

## Non-negotiable invariants
- Do not modify, delete or migrate the two original Android appointments.
- Keep `acceptingBookings: false`; real customer bookings remain disabled.
- No Cloud Functions deployment, Firestore write, database creation or IAM grant in this preparation stage.
- Do not assign unconditional project-wide `roles/datastore.user` to the public publisher.
- No private customer data, backups, appointments or client profiles may be copied into the public database.
- Do not switch `getFirestore()` to the named database globally; other functions depend on the default database.
- Public business listing data must be explicitly allowlisted; do not serialize the private business profile wholesale.

## Completion criteria
Phase 17 database isolation is **not complete** until the split is implemented, tested, permissions verified, migration/rollback planned, and separately approved for deployment. This document alone does not satisfy those criteria.
