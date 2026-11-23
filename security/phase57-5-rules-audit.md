# Boustio Phase 57.5 — Rules evidence and risk audit

## Verified evidence
GitHub Actions [run 45176857254](https://github.com/nathanboustead85-bit/SalonBook-Pro/actions/runs/45176857254) completed the `firestore-rules-emulator` job successfully, including the local emulator test command. This is **repository-rule emulator evidence**, not an independent comparison with published Firebase rules or a production security approval.

## Findings requiring owner and independent security review
- **F1 — Cloud backups:** `/users/{userId}/backups/latest` allows read/write for the authenticated owner, without email verification or field/size/schema constraints. Emulator test explicitly demonstrates that unverified owner writes succeed. Decide whether to require verification and a validated envelope; review Android backup/restore compatibility before changing anything.
- **F2 — Legacy booking writes:** `/users/{userId}/liveData/bookings` permits verified owner writes until the migration marker exists or booking mode differs from `legacy`. Emulator tests show both controls deny writes when activated. Confirm migration completeness and rollback design before restricting this path. Never modify the two original appointments.
- **F3 — Public directory:** Published business documents are readable without authentication. Review actual published fields to ensure they contain only intentionally public information.

## Remaining evidence
1. Read the active Firebase project ID and rules release identifier in Firebase Console. Do not share credentials or service-account keys.
2. Export or inspect the *published* rules and compare exact content with `firestore.rules`; record reviewed differences and the reviewer. The user-pasted copy is not independent proof of equality.
3. Expand emulator regression coverage for malformed backups, missing booking mode, migration transitions, cross-business boundaries and directory publication.
4. Obtain independent review and explicit permission before any rule publication, staging operation or production change.

**No deployment, no Firebase changes, no live bookings, payments, messaging, or App Check enforcement. All seven launch blockers G1–G7 remain OPEN. Original Android appointments: DO_NOT_TOUCH.**
