# Phase 59.15 — Customer-facing chat interface preview

Adds a responsive teal-and-white Boustio customer messaging interface at `web/chat/customer-chat.html`, with a sample Kody Blends conversation, safe DOM-only text previews, JPEG/PNG/WebP selection (5 MB cap), microphone recording controls with a 60-second automatic stop, and mobile layout. It is **strictly offline**: messages are not sent, attachments are not uploaded, voice notes are not delivered, and no customer information is persisted. All user text uses `textContent` instead of HTML injection.

This is a visual/interaction prototype, not an authenticated production customer chat route. Next steps: business-side inbox, trusted authentication, real-time subscription, accessible recording state/error flows, attachment sanitization on the server, and end-to-end emulator integration. No production services or Android app files changed. All seven gates remain OPEN.
