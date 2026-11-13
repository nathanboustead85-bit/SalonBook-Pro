# Phase 12.34 — Simulated backup role separation

**Offline policy only; no production IAM or Firestore permissions are changed.**

The proposed model uses three distinct roles:
- Backup writer: may create new versioned backup objects, cannot read, overwrite or delete.
- Restore reader: may read and list backup versions, cannot create or delete.
- Deletion administrator: may submit an independently reviewed deletion request, but has **no direct delete action** in this model.

All unknown roles/actions are denied. Even a deletion request carrying an approval ticket returns REVIEW_ONLY and performs no destructive operation. The policy tests 15 role/action combinations, invalid role inputs, role separation, approval evidence, and invalid backup IDs.

This is not a simulation of actual Google Cloud IAM enforcement. A production rollout must verify IAM policies and Cloud Storage bucket protections against actual isolated test identities, including service-account credential handling, privilege escalation paths, retention rules, audit logs, and deletion procedures. No production backups, appointments, rules or booking modes are changed. Production migration readiness remains NOT_READY.
