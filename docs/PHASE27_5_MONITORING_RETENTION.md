# Phase 27.5 — Monitoring reliability and data retention policy

**Status: offline policy and automated tests only. No live monitoring or TTL configuration.**

The prototype defines a maximum **14-day aggregate monitoring retention** and **48-hour abuse-budget retention**, validates timestamps, flags expired records, and fails closed on stale metrics, unverified alert delivery and unverified Firestore TTL configuration. These are proposed policies for future privacy review, not deployed retention guarantees.

## Critical implementation limitations
- Existing Firestore budget records use numeric `expiresAtMs`. Firestore TTL requires a configured TTL policy on a timestamp field; numeric expiry values **do not automatically delete documents**.
- No TTL policy, scheduler, deletion job, Cloud Monitoring alert, external notification or production configuration has been installed.
- The offline evaluator does not read production data or verify monitoring delivery; its simulated inputs cannot grant messaging launch approval.
- Before deployment, define the precise Firestore collections and TTL timestamp fields, test deletion with staging records, verify billing and query indexes, establish alert recipients/escalation and confirm UK GDPR retention/privacy requirements.
- Existing appointments are not accessed or modified. Messaging remains disabled.

Next: staging-only TTL schema and emulator safety checks, followed by a separate explicit approval process for any production changes.
