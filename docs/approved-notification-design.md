# Boustio — Approved appointment notification design
Approved by product owner: 24 November 2026

## Product decision
Boustio will include **automated email booking confirmations and appointment reminders** in the core affordable offering, plus **free one-tap WhatsApp reminder handoffs** for the business to send manually. This design supersedes the earlier proposal to make official automated WhatsApp messaging a launch requirement. Do **not** implement unattended WhatsApp sending, browser bots, simulated taps, or unofficial APIs.

## Customer booking lifecycle
1. After a booking is authoritatively confirmed by the secure backend, enqueue one email confirmation containing the business name, service, staff where applicable, appointment local date/time, time zone and safe booking-management link.
2. Schedule configurable email reminders (default: 24 hours before; optional: 2 hours before). Send only while the booking is confirmed and customer email/consent and business preferences permit.
3. For WhatsApp, display a **Reminder Queue** to the business with due appointments and an explicit **Open WhatsApp** action. Prepare a personalized, prefilled WhatsApp message and open the customer's chat via a valid wa.me deep link. The business user reviews and taps **Send** in WhatsApp. Never mark a message as delivered merely because WhatsApp opened.
4. On rescheduling, cancel obsolete reminder jobs, schedule new ones, and send an appropriate email update. On cancellation, cancel all pending reminders and send a cancellation email if permitted.
5. Do not send messages for unconfirmed, deleted, canceled, or stale bookings.

## Business dashboard controls
- Email confirmation on/off; reminder on/off; reminder timing (24 hours and optional 2 hours).
- WhatsApp manual reminders on/off; queue showing upcoming due, opened, and manually acknowledged reminders.
- Preview and customize business-friendly message text without exposing private notes.
- Show missing email or phone clearly; never invent contact information.
- Customer preferences and consent respected; use minimal necessary personal data.

## Delivery, privacy and reliability
- Backend-only scheduling; queue idempotency keyed by booking ID, event type and booking revision, with deduplication and retries.
- Check current booking status and time immediately before dispatch; time-zone/DST-safe scheduling.
- Protect against accidental duplicate emails, cross-business data exposure and malicious booking-link reuse.
- Use a reputable transactional email provider, domain authentication (SPF/DKIM/DMARC), delivery/error monitoring, and unsubscribe/consent handling where applicable.
- WhatsApp handoff uses an external app/browser. Do not claim delivery, receipt or sending; opening wa.me shares the phone number with WhatsApp on user action.
- Email can be included in the core subscription without a per-message charge to the business, but email infrastructure still incurs operating costs. Monitor volumes and apply fair-use/anti-abuse safeguards.
- Do not enable live delivery until independent security, consent, data protection, staging, cost and launch checks pass.

## Phased delivery (proposed, not yet implemented)
- Phase 62: secure notification settings, consent model, scheduling design and tests.
- Phases 63–64: backend email integration and booking-event wiring; WhatsApp reminder queue and prefilled message handoff.
- Phase 65: end-to-end test with booking/rescheduling/cancellation, duplicate prevention, offline conditions, and provider failures.
- Phase 66+: independent launch approvals before production enablement.

## Current launch safety
This document is **approved design only**, not a claim of implemented or live automated reminders. All seven launch blockers remain open. Keep live bookings, payments, messaging and deployment disabled. Preserve original two DEV appointments, TEST data, separate package and stable signing.
