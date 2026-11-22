# Phase 49.1 — Real staging readiness and independent verification plan

This is a **planning artifact only**. It neither connects to nor provisions staging. Five pre-access prerequisites and seven blocker-specific closure criteria are represented as immutable, unapproved evidence requirements. Claimed approvals cannot enable features.

## Approval sequence (no access authorized)
1. Obtain independent approval of a dedicated, separate non-production Firebase project and data boundary. Document project ownership, region, billing alerts and explicit isolation from production; **do not store project IDs or secrets in this repository**.
2. Independently review a least-privilege IAM matrix for each named human/service principal: resource scope, minimum roles, justification, duration, approver, revocation and audit logging. No broad Owner/Editor roles or downloaded long-lived keys. Any future workload identity requires separate approval.
3. Review privacy, test-data provenance, incident response, monitoring, kill switches, rollback and cost limits before granting any access.
4. Collect independent security evidence for Admin checkRevoked, App Check and distributed replay, browser/Android revision consistency and concurrency, and manual Samsung accessibility/recovery.
5. The **two original Android appointments** require a separate explicit owner-approved, non-destructive backup, restore and rollback protocol. No real appointment data may be read or migrated during Phase 49.1.
6. Record independent sign-offs against all seven existing blockers. None are automatically closed by test passes, owner claims, GitHub Actions or this plan.

**All seven launch blockers remain OPEN.** Live bookings, payments, messaging and deployment remain disabled. No real staging, production or physical Samsung access is performed.
