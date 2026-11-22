# Phase 38.4 — Isolated business dashboard recovery

Opt-in read-only coordinator wraps the Phase 38.3 owner authorization gate. Every refresh re-obtains injected credentials and revalidates the owner/token and atomic business documents. Epoch fencing prevents stale concurrent reads, sign-out and account changes from republishing private data. Network loss and background transitions clear the view; recovery requires a new read. Retries are manually initiated and bounded; there is no polling, timer or automatic retry storm.

Unit and real Firestore emulator tests cover synthetic recovery, unverified and cross-owner denial. The module is not wired into production Android or public browser hosting. Existing live bookings, payments, messaging and deployment remain disabled; original Android appointments are not accessed. Passing CI is not production launch approval.
