# Phase 35.4 — Isolated network resilience and safe recovery

Uses a real Firestore emulator read-only transaction for the Android business profile, services and staff documents, with injected deterministic network failures to test retries. The bounded retry wrapper retries only `unavailable`, `deadline-exceeded`, `resource-exhausted`, and `aborted`, using 1s, 3s and 10s delays (injected clock/wait in tests). Permission-denied and other errors are terminal. Cancellation is checked before every attempt and after every error. It never reads bookings.

The network coordinator clears dashboard data on refresh, sign-out, network interruption and failures, discards late responses and requires an explicit verified session after an outage. Real network cable drops and Firebase backend outages are **not** simulated; the tests inject Firestore-style errors into the real emulator transaction path. The existing 24h freshness threshold is provisional.

Production integration remains blocked on a trusted SDK adapter, token lifecycle listener, actual cancellation, consistent freshness policy and full error classification. Existing rules/config untouched; no production data, Android appointments, live bookings, payments, messaging or deployment.
