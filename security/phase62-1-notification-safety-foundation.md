# Phase 62.1 — Notification safety foundation

The Android code now includes an isolated, **non-invoked** notification policy object for future secure integration. Every live email, WhatsApp and booking flag is **false**. Even a valid booking snapshot cannot pass the email queue gate while live email is disabled. There is no sender, scheduler, backend, persisted notification preference, external WhatsApp launch or new Android permission.

Future integration must authenticate the business owner server-side, verify authoritative booking status and revision immediately before dispatch, check consent/preferences, deduplicate by business/booking/revision/event, and protect against cross-business access. This local model is not a substitute for those backend checks.

The approved design remains docs/approved-notification-design.md. All seven launch blockers remain open; live bookings, payments, messaging and deployment disabled. Preserve separate DEV 11.13 with two original appointments, saved TEST data, isolated package and permanent signing key.
