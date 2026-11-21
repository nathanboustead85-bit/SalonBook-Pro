# Phase 31.6 — Offline read-only schedule foundation

This pure function consumes a **validated Phase 31.3 FRESH_READ_ONLY display** and a **separately supplied owner-authorized staging schedule**. The published catalogue has no verified public working-hours endpoint; do not fetch private `liveData` from a customer browser.

Schedule contract (proposed staging-only): `{schemaVersion:1,businessId,slug,revision,openingHours:{'YYYY-MM-DD':[['09:00','17:00']]},staffHours:{staffId:{'YYYY-MM-DD':[['09:00','12:00'],['13:00','17:00']]}}}`. Dates are local business calendar dates. Time ranges are half-open. Missing hours fail closed; explicit empty ranges mean closed. Overlapping or malformed intervals are rejected. Only active/published staff and services already allowed through Phase 31.2 can be selected. Revision and identity must match the display; expired displays are rejected.

The intersection of business opening hours and staff hours is enumerated in configurable 5/10/12/15/20/30/60-minute steps, checking full service duration. **This is not bookable availability**: appointments, breaks beyond supplied schedule, holidays, concurrent bookings, timezone/DST and authorization of schedule provenance are not yet connected or verified. Output is labelled `OFFLINE_SCHEDULE_PREVIEW` and `UNVERIFIED_NO_APPOINTMENT_CONFLICTS`, always `bookingEnabled:false`. Do not show these times as confirmed customer-bookable slots.

No Firebase reads/writes, live bookings, payments, messaging, deployment, Android files or original appointments are touched.
