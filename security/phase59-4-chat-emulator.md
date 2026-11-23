# Phase 59.4 — Executable Firestore chat rules emulator tests

This phase tests **existing** `firestore.rules` against the Firebase Firestore emulator using synthetic documents only. The test suite covers verified business owner reads and lists, other-business denial, unverified and unauthenticated denial, customer denial, and create/update/delete denial for conversations and messages. All rules are loaded into an ephemeral emulator project `demo-boustio-phase594`.

The existing `.github/workflows/chat-emulator.yml` refers to absent `functions/` files; this new standalone harness does **not** claim to fix that legacy workflow. It is a separate executable suite.

## Limitations
These tests verify the **current owner-read-only chat foundation**. They do not implement real-time chat, customer access, trusted backend writes, photo uploads, voice-note duration checks, notifications, quotas or independent approval. Firebase emulator results are not production staging results. All seven gates remain OPEN; no deployed rules or Android data are changed.

Run via the dedicated GitHub Actions workflow. The test command is `node --test chat-rules.test.cjs` within `tests/phase594-chat-emulator`, executed under `firebase emulators:exec --only firestore` from repository root.
