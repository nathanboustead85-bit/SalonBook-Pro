# Phase 32.8 — Real Firebase emulator business data integrity

Exercises existing production `firestore.rules` against isolated local Firebase Firestore/Auth emulators using fictional business records. Covers valid service/staff/profile updates, invalid schema versions, invalid JSON field types, malformed timestamps, missing and extra fields, forged ownership, oversized service JSON, profile field-length boundaries, booking activation attempts and cross-owner/unverified/anonymous writes. Frozen booking-mode data writes remain denied. Existing accepted records are checked after rejected writes.

**Scope limitation:** Firestore rules enforce that `liveData.json` is a string of at most 500000 characters, not that the string contains valid JSON or conforms to a service/staff domain schema. The positive boundary test deliberately uses an arbitrary 500000-character string. Additional trusted backend/application validation is required for semantic integrity; do not interpret these tests as proof against all malicious payloads.

Uses only `demo-boustio-phase32-staging` with loopback emulators. No production credentials, Android appointment access, live booking, payment, messaging or deployment. Existing production rules remain unchanged.
