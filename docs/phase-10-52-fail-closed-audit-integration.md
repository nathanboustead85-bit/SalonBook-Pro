# Phase 10.52 — Fail-closed audit integration (emulator only)

The trusted emulator orchestrator constructs a private Phase 10.51 in-memory audit witness. After Phase 10.48 issuance commits its Firestore transaction, the orchestrator reads approval, audit, anchor and nonce documents and witnesses their evidence. Issuance returns success only after witness acceptance. If witness creation fails, the Firestore approval may remain approved but cannot be consumed by this orchestrator without witness evidence.

Phase 10.48 consumption now requires a witness and verifies the complete scoped event **inside the Firestore transaction before any writes**. Missing witness, altered evidence, unavailable witness, or inconsistent data causes transaction rejection; the booking mode is not created. Caller request allowlists remain unchanged; callers cannot supply a witness, bypass flag, verifier, or trusted clock.

Six integration regressions test unwitnessed approval, altered audit, deleted anchor, witness outage, concurrent consumption and caller injection. All tests run only against isolated demo Firebase emulators.

**Production HOLD:** The witness is per-process, volatile and not durable. Process restarts or multi-instance routing lose witness state, so an otherwise valid approval fails closed. There is no independently administered append-only store, cryptographically signed receipt, replay-safe durable sequence, durable receipt reconciliation, or production key custody. Issuance commits to Firestore before witnessing, leaving a possible stranded approval on witness failure. A production design must solve the cross-system atomicity/receipt problem using a rigorously reviewed state machine, outbox/reconciliation, or equivalent with failure testing. The current in-memory witness is NOT an immutable independent audit.

No production deployment, Firebase production changes, booking deletion/freezing, or public booking activation.
