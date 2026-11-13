# Phase 12.33 — Proposed production backup architecture

**Status: DESIGN ONLY — NOT DEPLOYED — NOT APPROVED FOR MIGRATION.**

## Proposed separation
Use a dedicated Google Cloud project for backups, separate from Boustio's Firebase production project. Use a dedicated Cloud Storage bucket with uniform bucket-level access, object versioning, a carefully reviewed retention policy and optional retention lock only after testing. Do not apply irreversible retention locks during development.

## Identity and permissions
Use separate service identities: (1) backup writer that can create new versioned objects but cannot delete backups; (2) restore reader that can read backup objects only; (3) tightly controlled deletion administrator, with approval and auditing. Do not grant these roles to the mobile app or expose backup credentials in GitHub Actions. Review Google Cloud IAM permissions, storage access controls, organization policies, and effective privileges before implementation. Do not claim this separation is currently enforced.

## Data integrity and recovery
Backups should contain a schema-versioned manifest, timestamp, source business identifier, item counts, cryptographic digest, and restoration instructions. Store immutable versions with an independent checksum. Validate backup before restore; restore into a separate environment first; verify counts, IDs, lock consistency and hashes; only then consider a separately approved production recovery. Never automatically overwrite appointments.

## Retention and privacy
Proposed initial design target: 90 days, subject to GDPR retention justification, deletion obligations and customer contract review. Record a defensible retention schedule, disaster recovery objectives, access review, audit logging and key-management policy. Avoid storing client personal data longer than necessary. Backups may be subject to deletion requests; design must address retention locks and legal erasure before deployment.

## Costs and monitoring
Before provisioning, estimate storage, operations, network transfer and restore costs; set Google Cloud budgets and alerts. Configure alerts for missed backups, checksum failures, permission changes and unexpected deletions. Budget alerts are not hard spend caps.

## Release prerequisites
1. Review and approve the architecture, retention duration and data protection requirements.
2. Provision a separate backup project and bucket with least-privilege IAM and auditing.
3. Validate immutable/versioned backups, key management, access denial and deletion controls using disposable data.
4. Rehearse restoration and document recovery objectives and incident runbook.
5. Complete Phase 12.30 independent readiness review and obtain explicit owner release approval.

## Phase 12.33 implementation boundary
`functions/backupArchitecturePolicy.js` is an **offline configuration policy checker**, not a Google Cloud IAM audit, infrastructure provisioner or runtime security enforcement. It cannot prove that any control exists in production. No credentials, storage buckets, Firestore rules, production data or live booking settings are modified.
