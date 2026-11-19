# Phase 22.9 — Premium read-only business profile and settings

Implemented as isolated test-only dashboard preview. No production deployment.

The Settings tab shows owner-scoped business name, category, contact email, phone, address, description, and explicitly disabled booking/publishing status. It subscribes to the existing `users/{uid}/business/profile` document only after the verified owner dashboard session reports ready. The listener rejects cached results, missing profiles, mismatched business IDs, enabled bookings, or published profiles. It clears all fields on sign-out, owner change, auth interruption or listener error. Text is rendered with `textContent`, never HTML. No forms, edit controls or writes are added.

The workflow runs 35 real Chromium browser tests against isolated Firebase Auth and Firestore emulators: the 30 prior tests plus 5 new profile/privacy/XSS/mobile checks. Passing CI is required before declaring the phase complete.

Public registration, real customer bookings, live dashboard and publishing remain disabled. Android appointments, production Firebase and Firestore rules remain untouched.
