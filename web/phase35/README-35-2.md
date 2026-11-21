# Phase 35.2 — isolated atomic multi-document refresh and sign-out

This phase tests actual client Firestore `runTransaction` read-only transactions on the emulator for the three verified Android paths: private business profile, services and staff. The injected `createRefreshCoordinator` requires an `atomic:true` result and passes the actual transaction documents to Phase 34.3's schema/freshness validator. Its monotonically increasing request epoch prevents older overlapping reads and responses after sign-out or owner switch from repopulating the dashboard. Every new refresh clears prior display data immediately.

The `atomic:true` property is a **trusted adapter contract**, not cryptographic proof; an untrusted caller could lie. The emulator tests exercise a real SDK read-only transaction, but production integration must control the adapter boundary, auth changes, cancellation and retries. Transactions can retry under contention and can fail; all failures clear data. Phase 34.3's 24-hour document freshness policy and five-minute timestamp skew remain provisional. This phase does not enable a live SDK or claim full production readiness.

The emulator uses only demo project `demo-boustio-phase35-2` on localhost, existing unmodified rules and seeded dummy salon documents. No Android appointments, production data, live bookings, payments, messaging or deployment are touched.
