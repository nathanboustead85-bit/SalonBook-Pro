# Phase 10.54 — Secure durable witness integration (isolated emulator only)

The trusted emulator orchestrator can now select the Phase 10.53 filesystem-backed receipt witness using `durableAuditDirectory` at construction time. The directory is a **trusted test harness dependency**, never a request field. Existing emulator tests retain the original in-memory witness when no directory is configured.

Issuance first commits the approval to emulator Firestore and then exclusively creates a durable local receipt; issuance reports success only if the receipt was created. A fresh orchestrator configured with the same directory can verify that receipt and consume the approval. Consumption verifies the receipt inside the Firestore transaction before updating approval status or creating booking mode. Missing, corrupt or inconsistent receipts fail closed. Concurrent consumption across fresh orchestrator instances remains protected by the Firestore transaction.

Six new tests cover restart recovery, missing receipts, corrupted receipts, altered approval evidence, concurrent consumption and caller-injected directory rejection.

**Production HOLD:** Local files are not independent immutable/WORM audit storage. Filesystem administrators can alter or delete receipts. Files may be lost between hosts and are not cryptographically signed or independently attested. A crash between Firestore issuance and receipt creation strands an approved record, and recovery intentionally cannot mint a missing receipt from mutable Firestore data. There is no cross-system atomicity, multi-host durable consensus, independent audit service, or secure production key custody. No production deployment, production Firebase modifications, booking deletion/freezing, or public booking activation.
