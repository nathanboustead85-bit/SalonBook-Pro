# Phase 12.39 — Existing published catalogue compatibility

## Repository inspection
The existing `functions/index.js` `publishBusiness` function writes to `publicBusinesses/{ownerUid}` with fields:
`businessId`, `name`, `slug`, `category`, `phone`, `address`, `description`, `published: true`, `acceptingBookings: false`, `schemaVersion: 1`, `updatedAt`.
The `businessSlugs/{slug}` document maps slug to businessId.

**Important gap:** This v1 public profile does **not** publish service records, staff schedules or available slots. No existing live public read endpoint for those datasets was established in this inspection. Therefore Phase 12.39 deliberately **does not** claim to connect live services or availability.

## Implemented
- Read-only pure adapter for the actual v1 public business profile shape.
- Fail-closed rejection of mismatched slug, invalid schema, unpublished or unexpectedly booking-enabled profiles.
- `PROFILE_ONLY` status when a business profile is published but services/availability are absent.
- Separate **isolated test-fixture** adapter mapping sample service/staff/appointment snapshots into the Phase 12.38 slot generator.
- Static demo page that clearly shows booking disabled.
- Automated tests for these behaviours. No Firebase SDK, cloud reads/writes or deployment.

## Next required implementation
Design an owner-approved publication pipeline with public-safe services, staff schedules and **availability-only** output; never expose private appointment or customer data to browsers. Verify Firestore rules and a nonproduction read-only endpoint using emulators, then connect the browser after permission and schema tests. Production booking mode remains disabled; original Android appointments are untouched.
