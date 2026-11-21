# Phase 36.1 — Production-schema-compatible Android business dashboard adapter foundation

**Isolated, read-only, not connected to production.** This is an adapter foundation, not production approval.

The dependency-injected `createAndroidBusinessReader({db,doc,runTransaction})` reads exactly three documents in one Firestore read-only transaction: `users/{uid}/business/profile`, `users/{uid}/liveData/services`, and `users/{uid}/liveData/staff`. The actual Android profile uses `businessId`, `name`, `acceptingBookings:false`, `schemaVersion:1` and `updatedAt`. Services and staff are `{json,schemaVersion:1,updatedAt}` envelopes. The adapter normalizes Firestore Timestamp values and hands results to the existing Phase 35.2 epoch-gated freshness/schema validator. It does not invent a shared revision field or business-wide opening hours.

The SDK functions are **injected** rather than initialized here; emulator tests use real `firebase/firestore` functions with `@firebase/rules-unit-testing` contexts, real repository rules, and demo project `demo-boustio-phase36-1`. Tests cover owner reads, cross-owner and unverified denial, sign-out, in-flight owner switches, forbidden booking paths and fail-closed behavior.

Remaining blockers: a trusted production SDK/Auth listener is not wired; `atomic:true` is an adapter contract, not a cryptographic proof; timestamp age/skew policy is provisional; no genuine offline transport failures or Samsung end-to-end tests. Existing legacy booking rules still require separate review. **No live customer bookings, payments, messaging or deployment; no production Firebase changes; original Android appointments untouched.**
