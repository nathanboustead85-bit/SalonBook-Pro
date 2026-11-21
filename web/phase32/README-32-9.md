# Phase 32.9 — Offline business content validation and corruption recovery

Introduces a **new isolated read-only preview validation module**, not yet wired into the production business dashboard or booking API. Parses `liveData`-style envelopes (`schemaVersion: 1`, `json` string), checks array length, unique service IDs, required fields, integer `pricePence` between 0 and 10,000,000, integer `durationMinutes` between 1 and 480 (matching the existing Phase 31 scheduling maximum), bounded names, and active flags. All records must pass, or the result is `UNAVAILABLE` with `bookingEnabled:false`. Rejects oversized JSON before parsing.

The optional backup is validated independently and only returned as `RECOVERY_PREVIEW_ONLY` when the primary is invalid. No automatic restore or persistence occurs. The module does not call Firebase or touch Android appointments.

**Important:** The `pricePence` field and maximum price are a proposed preview-only schema, not a claim about the existing Android/Firebase service schema. Integration requires mapping and validating actual stored service fields first. Tests do not prove existing production data is repaired or production corruption handling is complete. No deployment, live booking, payments or messaging.
