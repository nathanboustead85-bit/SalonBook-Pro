# Phase 10.58 — Cross-phase security regression

**Emulator-only, development branch; production HOLD.**

Six additional integration tests combine the trusted orchestrator, verified Firebase Auth ownership, Ed25519 operator assertions, project-wide nonce replay prevention, independently fingerprinted local durable receipts, default-deny role checks, single-use Firestore transactions and immutable-in-operation booking source invariants.

Scenarios: forged signature and wrong owner before issuance; replay of signed nonce across approval IDs; deleted independent receipt after issuance; altered project-wide nonce ledger; caller-injected role escalation; and concurrent consumption followed by replay. Each scenario verifies protected booking data remains unchanged, with approval/mode state checks where relevant.

These tests supplement, rather than replace, earlier isolated tests. Passing them is **not** a production security sign-off. Admin SDK retains broad emulator privileges, the filesystem receipt store is not independently immutable/WORM, and there is no production IAM/key custody deployment or independent audit service. No production writes, function deployments, booking deletion/freezing, or public booking activation.
