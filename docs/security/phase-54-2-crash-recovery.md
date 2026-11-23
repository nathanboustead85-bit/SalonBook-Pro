# Phase 54.2 — Synthetic restart and crash-interruption tests

Adds fault injection after original snapshot write, transaction marker write, pending write, active replacement, pending cleanup and marker cleanup. Unit tests recreate the journal object after a simulated process death. Marked incomplete transactions must roll back to the original synthetic snapshot; ambiguous orphaned originals must fail closed, not silently discard the backup.

**Known limitations:** A crash after the original copy is written but before the marker is written leaves an orphan and requires a future safe reconciliation procedure. A crash after the marker is removed but before the original copy is removed also leaves an orphan and fails closed. These are deliberately unresolved recovery gaps, not launch-ready behavior. The callback throws an Error to simulate abrupt process termination; no real power-loss, process kill, multi-process concurrency, directory fsync, encryption or device-level test is performed. No live Android preferences are read or modified.

No APK distribution, installation, Firebase deployment, release approval, IAM changes or live feature enablement. All seven launch blockers remain OPEN; the two original Android appointments are untouched.
