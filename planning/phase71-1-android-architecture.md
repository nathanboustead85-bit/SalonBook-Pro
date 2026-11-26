# Phase 71.1 — native integration baseline

Four existing activities inspected: MainActivity, ClientActivity, ManagementActivity, CloudActivity. Home, Calendar, Clients and Settings remain unchanged. The inventory maps 22 website feature areas; an engine or placeholder is not a completed native interface.

Existing standard app has Firebase account/backup functionality; isolated manifest removes network permissions and disables backup. No standard app installation or live backend operation is part of this phase. Preserve the existing salonbook_data preferences and all records. Source hash checks protect current implementation, not proof of device data integrity.

Risks to address in later phases: MainActivity rebuilds on resume; malformed booking JSON may yield a partial list; existing backup/restore is not a complete customer-data migration contract; role previews are not authoritative permissions. Do not invoke restore or migrate records during integration. Review lifecycle and transactional persistence before enabling new writes. Seven launch blockers remain open; no deployment.

Phase 71.2: plan unified navigation and synthetic preview entry points without replacing existing tabs or stores. Full isolated JVM regression required. No new APK needed for this documentation-only phase.