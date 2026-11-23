# Phase 57.7 — Non-deployed rules hardening candidate

The candidate at `security/candidates/phase57-7-firestore.rules` is an **isolated proposal**. The original `firestore.rules` and deployed Firebase rules remain unchanged.

## Candidate changes
- Backups: verified owner only; required `json`, `schemaVersion=1`, `updatedAt`; maximum JSON string length 500,000; no deletion.
- Legacy booking sync: explicit `bookingMode.mode == "legacy"` required, with migration marker absent.

## Unresolved compatibility blockers
1. **Backup format unknown:** The Android app may store backup documents in a different shape. The candidate deliberately rejects older arbitrary formats. Inspect actual Android serialization code and test representative **synthetic** backups before any adoption.
2. **Migration state unknown:** Existing installations may depend on missing bookingMode as legacy fallback. Verify migration transitions and recovery on disposable emulator accounts before adoption.
3. **Published rules comparison missing:** No independently verified equivalence to Firebase Console release.
4. **No deployment authorization:** Candidate is for isolated emulator tests only; independent review and user approval are required before any production or staging changes.

All seven launch gates G1–G7 remain OPEN. Original two Android appointments: DO_NOT_TOUCH. Live bookings, payments, messaging, App Check enforcement and deployment disabled.
