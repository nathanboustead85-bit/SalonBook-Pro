# Phase 22.7 — Premium read-only service and staff management screens

**Committed; CI result pending. Deployment NO-GO.**

Adds premium teal-and-white read-only cards for services (name, valid numeric price in GBP, positive integer duration in minutes) and staff (name and optional role). Unsupported price and duration values are omitted rather than guessed. Owner-scoped Firestore data is read through the isolated Firebase Auth/Firestore emulator browser harness and rendered using text nodes, never injected HTML.

This phase deliberately introduces a separate read-only management renderer and browser entrypoint, retaining the prior Phase 22.6 files. Existing 20 security/navigation/data tests plus five new real Chromium checks validate service details, invalid values, HTML injection, sign-out clearing, and mobile read-only usability.

**Not enabled:** public registration, customer bookings, live dashboard, editing, publishing, Firebase production connections or deployments. No Android appointments are accessed or changed.

**Acceptance:** verify 25/25 browser tests passing in GitHub Actions before marking complete.
