# Phase 44.3 — Isolated read-only business data integration

Composes Phase 44.2 owner session authorization with the inspected Android v1 profile, services and staff document mapping. Requires exact owner-scoped paths, matching businessId, schema validation, timestamps within five minutes, and re-verification after reads. Clears all displayed data on account changes, offline, sign-out, errors and teardown; fences delayed responses.

All callbacks and identity claims are synthetic or Firebase emulator-only. **This is not real trusted staging integration or production approval.** Timestamp freshness is not a shared revision guarantee; Android v1 opening hours and cross-device revision remain unverified. Phase 43 launch blockers remain open.

No Android appointment data is read or migrated. No production Firestore rules/config changes or deployment. Live bookings, payments and messaging disabled.
