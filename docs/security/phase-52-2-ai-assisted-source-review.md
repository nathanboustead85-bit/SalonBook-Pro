# Phase 52.2 — AI-assisted source security review

**Status: preliminary code review, NOT an independent professional audit, NOT launch approval.** Reviewed source from `boustio-phase-49-3-security-verification` on 2026-11-23. This review is performed by the same assistant helping implement the project; it is **not organizationally independent**.

## Findings requiring investigation

| ID | Severity / confidence | Source | Observation | Safe follow-up |
|---|---|---|---|---|
| A1 | High impact if misconfigured / confirmed source | `app/google-services.json`, `production-deployment.yml` | Tracked Android Firebase configuration targets production project `salonbook-pro-ad5ff`, while Phase 51/52 security evidence concerns `boustio-staging`. This is not automatically wrong for a production Android build, but a staging test APK must not silently use production Firebase. | Add build-variant project-ID assertions and explicit environment labeling before any staging APK test; do not alter the user's installed APK or original appointments. |
| A2 | Medium / confirmed source | `app/src/main/AndroidManifest.xml` | `android:allowBackup="true"` with no explicit backup/data-extraction rules. Local SharedPreferences contain bookings, services and staff. Platform backup behavior and sensitive-data exposure require review. | Evaluate Android backup/data extraction policies and recovery design using a separate synthetic test installation; do not change backup policy without migration/restore impact analysis. |
| A3 | High impact / confirmed source | `app/src/main/java/com/salonbook/pro/CloudActivity.kt` | Restore commits cloud-provided bookings/services/staff over local preferences after a dialog and JSON-array syntax checks; there is no visible snapshot rollback or deeper schema validation in this activity. | Design non-destructive preview, schema validation and atomic rollback tests on synthetic data before any changes. Never use original appointments. |
| A4 | Medium / confirmed source | `CloudActivity.kt` | `auth.currentUser!!.uid` dereferences the current user when building a backup path. Sign-out/session transitions warrant testing. | Capture user UID once per operation and test account switching with synthetic users before implementing. |
| A5 | High impact / not established by source | `CloudActivity.kt` and staging Firestore rules observations | Email verification is checked in client UI. Client-side checks do not prove server-enforced owner authorization; current staging deny-all rules intentionally prevent client backup/restore. | Review published rules and backend access design; do not relax staging rules without independently tested owner-isolation rules. |
| A6 | Medium / scope limitation | repository tree and `production-deployment.yml` | The reviewed branch does not expose a complete deployed web/backend implementation. A deployment-gate YAML file is not evidence of a deployed backend or active protections. | Obtain deployed asset inventory and review actual hosting/backend code before launch. |
| A7 | Informational / confirmed source | `app/google-services.json` | Android Firebase API key is present in tracked client configuration; such keys are generally client identifiers, **not service-account private keys**. | Check API key restrictions, quotas, allowed APIs and abuse monitoring; do not label it a leaked private credential solely because it is in `google-services.json`. |

## Limits

This is a static, partial-source review, not a penetration test or proof of real Firebase permissions. A second AI/model can challenge these findings but does not automatically count as a qualified independent human reviewer. The reviewer should examine the actual deployed website and Android release build as well as effective IAM, authentication, published Firestore rules, payment/messaging flows and operational controls.

## Launch safeguards

All seven gates remain OPEN. No merge, deployment, Firebase rule change, App Check enforcement, payment, messaging or live bookings. Do not access, restore or alter the two original Android appointments.
