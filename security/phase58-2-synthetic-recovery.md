# Phase 58.2 — Disposable synthetic recovery harness

This test harness writes **synthetic data only** to a temporary filesystem directory in GitHub Actions. It validates the Android-compatible backup envelope (`bookings`, `services`, `staff`, `schemaVersion=1`) before any commit, rejects malformed JSON, invalid schema and duplicate appointment IDs, and simulates a pre-commit interruption. A same-directory temporary file is atomically renamed into place for the synthetic fixture. Tests assert that original synthetic data survives rejected or interrupted operations.

**Scope limit:** This is a Node.js filesystem prototype, **not** Android SharedPreferences persistence or on-device atomic rollback. No Android app code is modified, no real Firebase is accessed, and no production backup or appointment is touched. A genuine Android implementation needs separate review and disposable-device verification before approval.

All seven launch gates G1–G7 remain OPEN. No deployment, live bookings, payments, messaging or App Check enforcement.
