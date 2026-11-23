# Boustio Phase 51 — Final evidence assessment and independent handover

**Assessment date:** 2026-11-23  
**Environment:** Boustio Staging (`boustio-staging`)  
**Branch:** `boustio-phase-49-3-security-verification` — draft PR #5  
**Decision:** **NOT APPROVED FOR LAUNCH. ALL SEVEN GATES OPEN.**

This is a consolidated **operator-observed and repository-source assessment**, not an independent security certification. No live Firebase API access or direct audit-log export was used to produce this assessment. User screenshots are evidence of displayed console state, not proof of effective IAM permissions or the complete deployed-resource inventory.

## Latest operator-observed IAM findings

The user provided three Google Cloud IAM screenshots with Boustio Staging selected. The visible rows show:
- A human principal with **Owner (Legacy)**.
- A Firebase Admin SDK principal with **Firebase Admin SDK Administrator Service Agent**, **Firebase App Check Admin**, **Firebase Authentication Admin**, and **Service Account Token Creator**.
- Firebase App Check Service Account with **Firebase App Check Service Agent**.
- Cloud Firestore Service Account with **Firestore Service Agent**.
- Firebase Rules Service Agent with **Firebase Rules System**.

The screenshots show recognizable Firebase-managed identities and no obvious unrelated third-party principal **within the visible rows only**. They do not establish full membership, inherited bindings, service-account impersonation scope, key inventory, audit history, or least-privilege compliance. The user previously reported no keys for the Firebase Admin SDK service account, but this was not independently exported or verified.

**Risk for independent reviewer:** Determine precisely who has `iam.serviceAccounts.getAccessToken`/`signBlob`/other impersonation abilities, which principal/resource the Token Creator grant applies to, and whether a role is Google-managed/required. **Do not remove roles on speculation.**

## Backend and Firestore observations

- Cloud Run Services and Jobs displayed empty-state lists in the selected Boustio Staging project; not an independently exported all-region inventory.
- Firebase Functions displayed a pricing-plan upgrade prompt; this is not a definitive API inventory.
- Firestore Rules editor displayed a recursive `allow read, write: if false;` policy. The published ruleset revision/time was not visible.
- Two Rules Playground runs displayed **Simulated read denied**; the request identity/path were not visible in the result screenshots. The second test's authenticated setting remains conditional on operator following the instructions.
- GitHub Actions previously passed isolated Firestore deny-all emulator tests, which tested a copied fixture, **not** a downloaded staging rules revision.
- Android `CloudActivity.kt` has client-side email verification checks and a cloud restore action that can overwrite local appointment-related preferences. UI checks do not prove backend authorization. Do not use the existing Android installation for destructive tests.

## Seven launch gates — evidence and decisions

| Gate | Evidence available | Missing decisive evidence | Decision |
|---|---|---|---|
| **G1 Staging isolation / IAM** | Staging project identity, IAM screenshots, visible Firebase agents, reported no keys, empty Cloud Run lists | Effective IAM/inheritance and impersonation audit, independently exported resource inventory, explicit staging-vs-production isolation | **OPEN** |
| **G2 Authentication** | Email/password enabled; Android UI checks email verification; synthetic token tests in earlier phases | Independently observed real staging email-verification, session expiry, revoked-token and account-isolation tests | **OPEN** |
| **G3 Firestore** | Deny-all editor screenshot, two simulated denied reads, isolated emulator tests | Published ruleset ID and independently observed staging client read/write negatives including cross-owner scenarios once owner rules are designed | **OPEN** |
| **G4 App Check** | Test-only setup previously reviewed, enforcement intentionally off | Independent attestation strategy, limitations and enforcement rollout approval | **OPEN** |
| **G5 Booking concurrency** | Prior isolated automated safety/regression suites | Independent staging verification of idempotency, conflicts, retries, safe failure | **OPEN** |
| **G6 Messaging / payments** | Both deliberately disabled; earlier offline security preparation | Independent abuse, attachment, quota and payment integration review before activation | **OPEN** |
| **G7 Operations / release** | GitHub evidence packages and staging console observations | Secrets audit, effective deployment authority, audit logs, billing alerts, rollback and independent reviewer approval | **OPEN** |

## Minimal next work — avoid repeated console screenshots

1. **Independent reviewer or read-only audit export:** obtain effective IAM bindings and resource inventory, including inherited roles, service-account impersonation, Cloud Run/Functions/Jobs by region, and relevant key metadata. Review offline; do not change IAM or enable APIs.
2. **Synthetic staging authentication verification:** independently test email verification, token expiry/revocation, account isolation and session transitions with a separately approved test plan and no personal appointment data.
3. **Published Firestore rules evidence:** retrieve published revision and negative client SDK evidence. The current deny-all policy is not an operational booking ruleset and must not be relaxed without separate security design and approval.
4. **Independent reviewer handover:** obtain reviewer identity, dated evidence, findings, explicit per-gate decisions and remediation plan. Only then consider a separately authorized staging deployment decision.

## Non-negotiable controls

- All seven launch blockers remain **OPEN**.
- No live bookings, payments, messaging, App Check enforcement, production changes, deployment, Firebase rules publishing, IAM changes, billing upgrades, or merging draft PR #5.
- Do not access, overwrite, restore, migrate or delete the user's **two original Android appointments**.
- A green GitHub Actions check or this report **cannot** authorize launch.
