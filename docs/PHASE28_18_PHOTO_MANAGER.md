# Phase 28.18 — Business Photo Management (interactive design preview)

This phase provides a premium, responsive teal-and-white photo management **demo**, located at `web/phase28/photo-manager.html`. It includes fictional service, staff and cover cards; category filters; feature selection; ordering; local removal; and a reset button.

The demo uses emoji illustration placeholders, not customer or business photos. All changes live only in JavaScript memory. Nothing is uploaded, stored, published, or deleted in Firebase. Add-photo is intentionally disabled. No booking or appointment code is modified.

The model validates IDs and safe display strings and returns copies to avoid accidental mutation. The UI uses DOM textContent, not innerHTML. Tests cover filtering, featured selection, reorder, reset, removal, malicious strings and isolation.

Next launch blockers: real authenticated owner dashboard, cloud Storage emulator rules, processing/scan/moderation, transaction-backed quotas, photo rights/consent, accessibility and Samsung browser visual tests, then explicit deployment approval.
