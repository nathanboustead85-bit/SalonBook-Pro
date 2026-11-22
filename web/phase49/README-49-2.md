# Phase 49.2 — Staging environment and access security review

Offline, read-only **planning** only. No real Firebase staging project, IAM principal, key, token, credential, deployment or service is created, connected or approved.

## Least-privilege IAM matrix
Four illustrative principals are documented in `access-review-49-2.js`: human staging reviewer (metadata only), security auditor (read-only redacted logs), CI emulator runner (no cloud roles) and future staging verification service (no role granted; minimum permissions to be independently defined). Each requires named identity, exact resource, least-privilege role, justification, time limit, independent approver, logging and revocation plan before any real grant. No broad Owner/Editor grants or downloaded long-lived keys.

## Staging isolation and credential controls
Verify dedicated non-production project ownership, resource and billing separation, synthetic-only data, redacted logs, alerts, incident response, approved short-lived identity and explicit security authorization. Do not place project IDs, service-account credentials or secrets in source code, logs or GitHub Actions. CI remains local Firebase emulator only.

## Independent approval evidence template
For each of the six controls, record outside this repository: control ID, responsible reviewer, evidence reference (no secrets), timestamp, project boundary attestation, least-privilege rationale, findings, remediation, decision, approver and expiry. Evidence is currently **MISSING**; claims in code cannot authorize access.

Seven launch blockers remain OPEN. Two original Android appointments are NOT ACCESSED OR VERIFIED. Live bookings, payments, messaging and deployment remain disabled.
