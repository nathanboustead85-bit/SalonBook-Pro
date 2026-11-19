# Phase 25.4 — Buffer-aware synthetic conflict protection

This additive read-only synthetic preview composes Phase 25.1 availability, Phase 25.2 explicit service/staff matching, Phase 25.3 fictional appointment records and Phase 24.7 scheduling policy. Candidate appointment start/end is expanded by configured preparation/cleanup buffers, and existing fictional appointment start/end is likewise expanded by those buffers. Any overlap excludes the candidate time. This is intentionally conservative; buffers on both sides may exclude more time than a future production policy. Adjacent times remain possible with zero buffers. A malformed saved policy, matching or appointment record fails closed.

All appointments are synthetic owner-scoped local demo data. Existing Android appointments and production Firestore are not accessed or changed. No server reservations, concurrency controls, booking holds or real availability guarantees are provided. The example clock is fixed to 2026-11-19 for deterministic demonstration. Live bookings, registration, payments and publishing remain disabled.

Dedicated GitHub Actions uses read-only permissions, Node integration tests, real Chromium mobile/desktop/keyboard tests and isolated Firebase Auth/Firestore emulator denial tests. No production credentials or deployment.
