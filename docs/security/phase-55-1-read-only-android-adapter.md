# Phase 55.1 — Android storage read-only adapter foundation

The existing app uses `getSharedPreferences("salonbook_data", MODE_PRIVATE)` and keys `bookings`, `services`, `staff`. This change introduces an **isolated** reader interface with no Android framework implementation, so no existing user data can be accessed or changed. The adapter rejects missing, oversized, non-array-shaped and unreadable preference values rather than substituting empty arrays. Synthetic tests preserve two sample booking records and verify no mutation.

**Limitations:** This is an interface and unit-tested snapshot mapper, not a real Android storage integration. Array-shaped checking is not full JSON/schema validation; the adapter does not validate business ownership, consistency or record identifiers. No journal writing or SharedPreferences restore is permitted. The live app still writes directly to preferences, and no migration is enabled.

Do not deploy, install an APK, modify existing appointments, publish Firebase rules, or enable live features. All seven launch blockers remain OPEN. A real read-only Android adapter and instrumented staging tests must be separately designed and approved before real-data use.
