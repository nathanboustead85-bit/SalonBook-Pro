# Phase 33.2 — Android service schema compatibility (offline, read-only)

Source reviewed on the development branch: `app/src/main/java/com/salonbook/pro/ManagementActivity.kt` displays Android services using `id`, `name`, string `price` in GBP, integer `duration` in minutes and optional `publicVisible`. `CloudSyncManager.kt` uploads the JSON array into `users/{uid}/liveData/services` with `json`, `schemaVersion:1`, `updatedAt`.

The mapper translates a strictly validated subset of legacy Android records to Phase 32.9's preview schema (`pricePence`, `durationMinutes`, `active`) and then delegates to Phase 33.1's read-only dashboard adapter. Missing visibility defaults to private. The conversion rejects malformed prices, durations, duplicate IDs and stale/mismatched owner contexts. Extra legacy metadata is intentionally omitted from the preview rather than used as privileged fields.

**Limitations:** This adapter is offline and not wired to Firestore, Android, or a deployed web dashboard. Actual records may contain older variants not represented by the inspected code; those need fixture-based verification before use. The caller must obtain and authorize owner snapshots through trusted Firebase rules. No production data or bookings are read or changed.
