# Phase 25.5 — Advanced synthetic availability reliability and edge cases

An additive, read-only synthetic reliability layer over Phase 25.4. Checks demonstration dates, valid service/staff IDs, explicit matching, deterministic slot ordering, duplicate slot suppression by rejection, and conservative buffer-aware filtering. Invalid saved policy, matching or appointment drafts fail closed with no times. Fictional multiple appointments, staff breaks, closed days, booking horizon, browser reload and narrow/wide viewports are covered by a dedicated regression suite.

No live availability, appointment reservations, concurrent booking holds, real customer accounts, payment operations or production Firestore reads/writes. The fixed example date is 2026-11-19, and the slots are strictly illustrative. The browser uses fictional sessionStorage only. Existing Android appointments are not accessed or modified. Registration, bookings, payments and publishing remain disabled.

GitHub Actions uses read-only repository permissions, Node integration tests, real Chromium mobile/desktop/keyboard tests and isolated Firebase Auth/Firestore emulator denial tests. No deployment.
