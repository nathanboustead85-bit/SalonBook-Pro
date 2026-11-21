# Phase 32.7 — Booking mode and migration security

Tests the existing repository `firestore.rules` in isolated local Firebase emulators with fictional accounts. Covers missing booking mode, explicit legacy, frozen, cloud, invalid modes, and each relevant mode with a trusted-backend-created migration marker. Confirms that migration completion blocks legacy booking uploads, that verified owners cannot change mode or markers, that unverified/foreign/anonymous users cannot write bookings, and that legitimate services writes remain possible. Simulates backend-only transitions in emulator and verifies subsequent writes are denied.

**Important legacy compatibility:** Existing production rules explicitly permit verified-owner writes to `users/{uid}/liveData/bookings` while booking mode is missing or `legacy` and migration has not completed. These tests assert that existing policy; they do **not** claim that every booking write is currently denied. No rules or live settings are changed.

All records and transitions are synthetic and isolated. Existing Android appointments are not accessed. No production cloud, payments, messaging, live booking activation or deployment. This is client-rule validation, not an Admin SDK/backend transaction security audit.
