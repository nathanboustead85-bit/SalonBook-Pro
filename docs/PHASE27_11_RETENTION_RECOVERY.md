# Phase 27.11 — Security counter failure and recovery tests

A **standalone fail-closed adapter** classifies transient Firestore failures and never turns an exception, malformed result or quota denial into permission to send a message. The Firestore emulator suite exercises corrupt counters, simultaneous retry attempts, recovery after a simulated outage, and preservation of a synthetic booking.

**Important limitations:** The adapter is not connected to live messaging. It does not automatically retry, avoiding unintended double-counting after ambiguous network failures. A caller may retry only after verifying transaction semantics and user experience. It intentionally returns generic failure reasons rather than sensitive error strings. Firestore transaction contention can still exceed retry limits, in which case denial is safer than bypassing quotas. The tests do not prove production resilience, real App Check enforcement, managed TTL or end-to-end client auth.

No deployment, no production Firebase access, no real booking modifications, no messaging activation.
