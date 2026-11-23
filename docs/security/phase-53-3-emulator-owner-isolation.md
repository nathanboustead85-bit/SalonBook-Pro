# Phase 53.3 — Synthetic Firestore owner isolation

This phase adds a **candidate policy fixture**, not deployed Firebase security rules. The emulator runs under demo-boustio-phase533 without any production or staging credentials. No actual salon, customer or Android appointment data is accessed.

Tests verify verified owners can read/update their own synthetic appointments, while another owner, an unverified account and an anonymous user cannot read, create, update, delete or list another owner's synthetic bookings or customer records. They also verify top-level enumeration and writes to unmatched paths are denied, and failed cross-owner tampering leaves synthetic records unchanged.

**Limits:** These checks do not test actual published Firestore rules, actual backend SDKs or real staging Firebase accounts. The deliberately simplified fixture grants broad write access to a verified owner within their synthetic business subtree; it does **not** establish production booking schema validation, concurrency protection, customer authorization or complete application rules. Do not copy this fixture into production. Published rules must be separately retrieved, reviewed and tested before G3 can close.

**Safety:** G1–G7 remain OPEN; no deployment, rules publication, live bookings, payments, messaging, App Check enforcement, APK replacement or modification of the two original Android appointments.
