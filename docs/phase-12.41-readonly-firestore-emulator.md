# Phase 12.41 — Isolated Firestore read-only security emulator

This phase tests a **proposed** public snapshot collection against separate, emulator-only Firestore security rules. It does not modify or deploy `firestore.rules`, `functions/index.js`, production Firebase data or Boustio hosting.

Collection used in the emulator: `phase1241PublicAvailability/{businessId}`. Public clients may get an existing document only if its status is PUBLIC_PREVIEW, schemaVersion is 1, bookingEnabled is false and its businessId matches the document ID. Listing, client writes and private appointment reads are denied. Trusted admin fixture seeding uses a test-only bypass.

The tests verify unauthenticated public reads, denied listing and writes (including owner writes), denied private reads, invalid public metadata rejection, and client-side snapshot staleness. **The public Firestore read rule does not enforce snapshot freshness**; the sample reader checks it. Before production deployment, stale data must also be addressed at a trusted API or server boundary.

The existing `publicBusinesses` v1 profile is not changed. This test does not yet read real services from owner private records, implement a scheduled publication job, or prove end-to-end availability on the live website. All customer booking writes remain disabled.

No original Android bookings are accessed or changed. Production migration remains NOT READY.
