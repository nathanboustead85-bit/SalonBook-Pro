# Boustio Phase 54.1 — Isolated disk-backed recovery foundation

Introduces `DurableRecoveryJournal`, a disk-backed, SHA-256-checked snapshot journal for synthetic bookings/services/staff. Uses atomic file replacement on a single filesystem; refuses to downgrade if atomic replacement is unsupported. Unit tests cover restart persistence, invalid payloads, corrupt snapshots and orphaned pending artifacts.

**Not yet safe for production:** This class is not wired into any Android activity or the real `salonbook_data` preferences. It has no proven fsync of the containing directory, no process-crash fault injection or Android device instrumentation, no full JSON object/schema validation, no encryption/authenticity, no multi-process locking and no migration integration. Snapshot hashes detect accidental corruption, not malicious tampering. An interrupted transaction may require explicit recovery before reading. Never use it to restore the two existing Android appointments.

**Safety:** No APK distribution, installation, deployment, production/staging Firebase access or modification of existing appointments. All seven launch gates remain OPEN.
