# Phase 62.2 — notification preferences and consent foundations

Added offline-only typed business settings and customer consent model, defaulting every notification choice to **false**. A preview eligibility helper requires both relevant business preferences and explicit customer opt-in. A separate consent-recorded check requires a valid timestamp. Preview eligibility does **not** authorize actual delivery: Phase 62.1 live flags remain false.

No UI, persisted consent records, Firebase writes, schedulers, network permissions, email or WhatsApp sending are enabled in this section. Future work must add authenticated server-side consent capture/audit, revocation, notification settings UI and independent verification. Do not treat this model as production consent compliance.

Preserve saved TEST data and separate DEV 11.13 with two original appointments. Stable signing and isolated package unchanged. Seven launch blockers remain open; live bookings, messaging, payments and deployment disabled.
