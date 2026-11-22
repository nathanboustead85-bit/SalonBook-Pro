# Phase 42.2 — Isolated authentication revocation and session lifecycle

An emulator-only, read-only security boundary around Phase 42.1: forced token checks, injected revocation decisions, post-read session revalidation, fail-closed unknown/error results, account switch, offline/reconnect, sign-out and teardown. The revocation verifier is **injected** and not a trusted backend; production revocation and App Check remain open launch blockers.

Only synthetic emulator data is used. No live booking, payment, messaging, production Firebase changes, deployment or Android appointment migration. Original Android appointments are never accessed.
