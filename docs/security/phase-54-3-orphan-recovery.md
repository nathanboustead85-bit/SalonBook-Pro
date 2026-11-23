# Phase 54.3 — Orphan original recovery

The isolated disk journal now treats a remaining valid `original.dat` as rollback evidence even when `transaction.marker` is missing. It restores and verifies the original synthetic snapshot before removing remaining journal artifacts. This closes the two **simulated** crash windows at after-original and after-marker-cleanup. Corrupt originals and pending files without a valid original remain fail-closed. Tests include repeated restart recovery.

This is conservative rollback: a crash during cleanup can discard an otherwise completed synthetic update. It must not be connected to real appointment preferences until transaction semantics, crash durability, schema checks and real-device validation are addressed. It is not an encrypted or tamper-resistant journal, not multi-process safe, and has no Android device/power-loss validation.

No APK, cloud deployment, production data, Firebase rules or live feature activation. All G1–G7 remain OPEN. Original Android appointments remain untouched.
