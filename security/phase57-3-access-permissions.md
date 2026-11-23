# Boustio Phase 57.3 — Staging access and permission testing

**Status: NOT VERIFIED. Offline policy simulations only.**

This phase creates a **non-authoritative** deny-by-default policy model and automated tests. It does not exercise real Firebase Auth, Firestore, Storage, IAM, Android devices, or staging infrastructure. Passing these tests is not evidence that deployed security rules enforce the model.

## Modelled access policy

- Anonymous callers are denied.
- Cross-business reads and writes are denied.
- A business owner may read only their own business data.
- Writes require both owner identity and verified email.
- Auditors have read-only access to specifically scoped staging data, never writes.
- Any request against production is denied by this staging-only model.
- Denied requests must never alter the original two Android appointments.

## Evidence still required

| Scenario | Required independent evidence |
| --- | --- |
| A1–A4 | Firebase emulator negative tests against actual version-controlled Firestore rules, then independently reviewed staging results |
| A5 | Staging IAM roles and effective-permission evidence for a disposable auditor account |
| A6 | Project ID, credential boundary, IAM and service identity isolation review |
| A7 | Before/after hashes from disposable staging records; never use real appointments |

All seven original launch blockers **G1–G7 remain OPEN**. Phase 57.1 prerequisites and Phase 57.2 security evidence requirements remain OPEN. Live bookings, payments, messaging, deployment and App Check enforcement remain disabled. No real staging or production access is authorized.
