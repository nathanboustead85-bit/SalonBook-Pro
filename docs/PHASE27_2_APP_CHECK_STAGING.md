# Phase 27.2 — Isolated Firebase App Check staging verification tests

**Status: test harness only; NOT wired to live callables or deployed.**

An isolated verifier adapter accepts an injected Firebase Admin SDK `verifyToken` function and requires a staging-only `enabled: true` input. It rejects missing/malformed tokens, SDK verification failures (including invalid signatures and expired tokens), replay-consumed tokens, missing verified app IDs and missing verifier functions. Successful responses request `consume: true` for token consumption, which requires appropriate Firebase App Check configuration and service permissions.

**Critical limitations:** tests use a simulated verifier, not real signed Firebase App Check tokens or an App Check emulator. The wrapper does not by itself secure any callable. The real chat callables still use `enforceAppCheck: false` and messaging remains disabled. The SDK's consumption behavior, attestation provider registration, token replay handling, legitimate web clients and real HTTP callable transport must be validated in a later isolated staging phase. Do not enable production App Check enforcement before compatible web/mobile clients are configured and verified.

No production deployment, App Check configuration changes, bookings or customer messages.
