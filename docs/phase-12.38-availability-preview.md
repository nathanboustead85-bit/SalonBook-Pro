# Phase 12.38 — Published services and availability preview

This phase implements a **static snapshot adapter**, not a live catalogue integration. The model consumes a published business object with service prices and durations, active staff, date-specific working hours, and existing appointment intervals.

The slot generator returns half-hour start increments only when the whole service duration fits inside one working-hours interval and does not overlap a confirmed appointment. Unpublished services, inactive staff, closed days, unpublished businesses and malformed hours/appointments are rejected. The customer-facing HTML page uses isolated sample data and labels all results as preview only.

The current sample date is 20 November 2026. **It is not real-time availability.** The sample data is not loaded from Firestore and must not be advertised as a live salon booking page. There are no writes, notifications, payments or booking confirmations. The original Android appointments and production booking mode are untouched.

Next steps: validate against the actual published catalogue schema, timezone and DST behavior, cancelled bookings, buffers, staff leave, booking cutoffs and concurrency; then connect a nonproduction read-only API and test it before considering any live customer booking capability.
