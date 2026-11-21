# Phase 33.4 — Business opening hours and closed-day read-only preview

Inspected Android `BusinessProfileActivity.kt` and `ManagementActivity.kt` on the active branch. The Android business profile does **not** establish a verified persisted business-wide opening-hours schema in these inspected files; `ManagementActivity.kt` stores **individual staff** weekly schedules. Therefore Phase 33.4 introduces an explicitly **proposed**, owner-supplied, offline preview schema: `{schemaVersion:1,days:{monday:{closed:false,intervals:[{open:"09:00",close:"17:00"}]},...,sunday:{closed:true}}}`. Every weekday must be present. It rejects malformed and overlapping intervals and preserves explicit closed days.

The adapter composes the Phase 33.1–33.3 read-only business, service and staff validators; it checks the supplied hours owner and revision match the validated business snapshot. It never infers business opening hours from staff schedules, never computes bookable availability, and never enables editing or booking.

**Not production integration:** a trusted future phase must identify actual persisted business hours, map their schema and enforce server-side Firebase owner authorization. No Firebase calls, Android appointment access, payments, messaging, or deployment occur.
