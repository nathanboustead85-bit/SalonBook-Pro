# Phase 12.40 — Public availability projection (offline prototype)

This phase adds a pure, testable **public-safe projection** from trusted owner-side sample records. It deliberately does **not** create or deploy a Firebase publication endpoint, write to Firestore, enable customer booking, or connect private Android data.

The projected output includes only published service IDs/names/prices/durations and per-staff-ID free start times for a specified date. It excludes source appointment documents, customer identities, private business contact fields, and working-hour source objects. It does not expose staff names. Booking mode stays false.

The reader requires matching business slug, expected schema, booking-disabled state and a snapshot generated within a five-minute freshness window. The slot algorithm remains the Phase 12.38 sample model: 30-minute increments, no timezone/DST or holiday handling yet. **Do not deploy it as live availability.**

The current publicBusinesses v1 document is still profile-only. Before actual publication: implement authenticated owner-only input reads, a separate publicly readable sanitized collection or callable, Firestore security rule reviews, schema versioning, privacy review, timezone and DST coverage, stale snapshot refresh, rate limiting, emulator tests and explicit release approval. No customer booking endpoint is enabled.
