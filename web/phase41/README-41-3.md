# Phase 41.3 — Isolated read-only dashboard data integration

Uses the existing Phase 36 atomic Firestore read adapter and Phase 39 Android v1 schema inspector to project synthetic owner business, services and staff into the Phase 39 read-only dashboard view. No production SDK initialization, public route or write path is introduced.

The Phase 41.3 coordinator fences asynchronous responses with an epoch and owner UID, clears state on sign-out and offline events, rejects non-atomic reads, malformed Android v1 records, foreign-owner paths and unverified users. Android v1 has **no verified shared revision**; any attempt to combine a proposed v2 revision envelope with v1 data is rejected rather than claiming cross-device consistency. Successful read-only display does not imply bookable availability.

Tests include synthetic Firebase emulator atomic reads, verified-owner versus cross-owner and unverified Firestore security rules, malformed fixtures, stale revisions, late responses, sign-out and offline recovery. Emulator setup writes only synthetic data inside the isolated test environment. No existing Android appointments are accessed, migrated or modified.

**Launch status:** staging not connected or approved, production not ready, security blockers from Phase 40.5 remain OPEN. Bookings, payments, messaging and deployment stay disabled.
