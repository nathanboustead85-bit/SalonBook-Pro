# Phase 38.2 — Isolated Android/browser schema compatibility

Adds a read-only compatibility gate over the existing Phase 34 Android Firestore mapper, Phase 34 freshness validation, and Phase 33 strict staff schedule mapper. Requires v1 business/profile/services/staff, verified owner, unexpired token, consistent atomic read attestation, fresh timestamps, valid service prices and staff references, valid hours and break exclusions. All invalid states return no business or staff data. No shared revision is inferred, and availability remains unverified.

Synthetic unit and Firebase emulator tests cover valid records, unsupported versions, malformed JSON, cross-owner access, invalid schedules, missing documents and read-only access. The test suite writes **only synthetic data into a local emulator**; production rules and appointments are not accessed.

This phase does not change the existing production-facing dashboard adapter, publish rules, enable live features or deploy. **A passing test run is an isolated compatibility milestone, not production launch approval.**
