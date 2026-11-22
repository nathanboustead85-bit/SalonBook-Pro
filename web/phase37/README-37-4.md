# Phase 37.4 — Isolated browser session resilience

Adds a fail-closed, subscription-based browser session guard on top of the Phase 36.5 audited session. It clears the displayed business data immediately on sign-out, account changes, network loss, stop, and token revalidation. Generation tokens reject stale asynchronous token results. Expired and unverified token claims fail closed. The existing Firebase emulator and browser integration remain read-only.

Tests include focused guard race/expiry tests, existing Phase 37.2–37.3 Chromium tests, new two-tab browser tests, and Phase 36.5 Firebase security regressions. Multi-tab tests use separate page contexts sharing the same browser profile, and ensure a sign-out in one tab clears the other tab. Tests do not prove production revocation, offline persistence safety, or deployment readiness.

No production Firebase, Android appointments, live bookings, payments, messaging or deployment are accessed.
