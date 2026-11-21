# Phase 33.6 — Offline dashboard loading, refresh and recovery

A deterministic, pure state-transition adapter around Phase 33.5. Each refresh begins in an empty `LOADING` state; a successful result requires a matching request ID, owner ID, fresh context and fully validated cross-section dashboard snapshot. Failed, incomplete, stale, out-of-order or cross-owner responses fail closed to `UNAVAILABLE`, with no business, staff or service data exposed. Starting a new refresh clears the prior snapshot rather than showing potentially stale details. Explicit reset clears state.

This is **not** a network loader or live retry scheduler. A future integration layer must supply authenticated, authorized, fresh snapshots and manage cancellation and retry; this module provides offline transition logic only. It does not access Android appointments, live Firebase, booking, payments, messaging or deployment. Business opening hours remain the provisional Phase 33.4 preview format.
