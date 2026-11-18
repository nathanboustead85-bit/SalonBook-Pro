# Phase 20.10 — Browser connectivity integration (test-only)

**Release decision: NO-GO.** No deployment or public feature activation.

An opt-in browser adapter now connects window online/offline events and navigator.onLine to the Phase 20.8 recovery monitor, using explicit window/navigator injections and browser timers. The adapter emits initial connectivity state, deduplicates repeated events, unregisters both listeners on stop, and treats unknown navigator state as offline. The monitor continues to clear cached private data, cancel pending retries on offline transitions, reconnect only the current authenticated owner, and wait for server-confirmed Firestore data.

Seven automated tests exercise initial offline state, duplicate online events, stale view rejection, repeated flapping, account switching, bounded retries, sign-out and listener teardown. Tests use simulated browser event targets and the real recovery monitor. Existing Phase 20.9 tests cover actual Firebase Auth/Firestore SDK emulator events; Phase 20.10 does not run a real browser engine or prove network reachability. navigator.onLine alone is not authoritative for Firebase availability.

The new module is **not imported by any live website entry point**. Public registration and customer bookings remain disabled, original Android appointments are untouched, and no deployment is performed. Await GitHub Actions results before marking verified.
