# Phase 27.8 — Actual chat budget schema compatibility audit

This is a **read-only source-code audit**, not an inspection of production Firestore documents. The audit inspects the three existing budget modules and is intentionally blocked from approving migration.

## Observed current paths
- `chatAbuseBudgets/{bucket}/identity/{uidHash}`
- `chatAbuseBudgets/{bucket}/business/all`
- `chatAbuseBudgets/{bucket}/signal/{signalHash}` (legacy optional path)
- `chatTrustedCorrelationBudgets/{bucket}/signals/{correlation}` (isolated prototype)

These are **nested subcollections**, not top-level documents in the named parent collections. The Phase 27.7 planner assumes top-level collection names and a `createdAtMs` value; it **must not be applied** to the observed documents without redesign.

## Confirmed source-level incompatibilities
1. Writers store numeric `expiresAtMs`, not Firestore timestamp `expiresAt`.
2. Writers do not store `createdAtMs`; Phase 27.7 correctly refuses these documents.
3. Parent document deletion does not cascade into subcollections.
4. A real TTL policy on the appropriate collection group/field is not configured or verified.
5. A retention window cannot safely be inferred from untrusted client values; migrations need server-derived provenance.
6. No production data was read. This audit cannot assert all deployed records match source.

## Next safe steps
Create emulator-only schema v2 writers with server-side creation timestamp and timestamp-based expiry, test migration of synthetic legacy records, ensure compatibility with transaction writes, and separately validate collection-group TTL configuration in a dedicated non-production Firebase project. Do not enable chat, migrate real data, deploy, or modify appointments.
