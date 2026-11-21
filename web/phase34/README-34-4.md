# Phase 34.4 — Offline read-only error handling and retry recovery

A pure state machine that clears business data before every refresh, denies stale/cross-owner callbacks, treats permission-denied and unauthenticated errors as terminal, and permits only bounded retries for transient errors. Retry delays: 1, 3 and 10 seconds (the initial request is attempt 1; maximum three attempts, hence only the first two delays are exercised). The state machine never schedules timers or makes network requests; the future SDK integration must supply a trusted clock, actual Firebase error codes, and cancellation.

Phase 34.3 freshness validation is required for a successful result. `consistentRead:true` remains a **caller assertion, not proof of an atomic Firestore snapshot**. This phase cannot guarantee cancellation of in-flight promises or secure server-side authorization. Those require separate emulator and real adapter integration tests.

All transitions are offline and read-only. No production rules, Firebase project, live bookings, payments, messaging, Android appointments or deployment are touched.
