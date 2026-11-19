# Phase 25.2 — Explicit staff/service matching

This is an **isolated synthetic demonstration**. Phase 24.4 services use `item-*` IDs, whereas Phase 24.5 staff use `staff-*` IDs and have a separate service catalogue. Phase 25.2 therefore creates an explicit owner-scoped mapping between validated existing service IDs and professional IDs, without assuming that similarly named entries are identical or changing either existing draft.

A service shows only explicitly assigned professionals. The availability preview produces illustrative times only for assigned service/staff pairs, then reuses Phase 25.1 working hours, business hours, breaks, buffers and date boundaries. Unmatched pairs return no slots. Assignment save/recover/clear only touches the synthetic `boustio-phase25-2:demo-*` storage record.

Real bookings, registration, payments and publishing remain disabled. Illustrative times do **not** check existing appointments, real staff-service qualifications, simultaneous requests or holds, and cannot be booked. Owner-scoped sessionStorage is not production authentication. Browser seed data is fictional; no production Firebase or Android appointments are changed.

Dedicated GitHub Actions runs Node integration tests, Chromium mobile/desktop/keyboard tests and isolated Firebase Auth/Firestore emulator denial checks. No deploy or production credentials.
