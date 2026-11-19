# Phase 26.6 — Messaging concurrency, account rotation and media audit

## Scope
Tests the actual chat callable handlers with a synthetic Firebase Admin implementation. The in-memory transaction queue serializes simultaneous requests and applies staged writes atomically. This models one class of contention but **does not prove Firestore emulator/production transaction retry behavior**. No cloud credentials, live Firestore, or deployments are used.

## Cases
- Chat release gate denies concurrent requests when disabled.
- Two simultaneous guest starts for one identity: one success, one already-exists, one conversation.
- Different anonymous identities create distinct conversations.
- Simultaneous messages contend on cooldown and at the 100-message quota boundary; one accepted, one rejected in the serialized mock.
- Cross-customer attempts are denied while another message is being processed.
- Demonstrates the **anonymous account rotation weakness**: fresh guest UIDs can create independent conversations and bypass per-conversation quotas.
- Existing handlers persist text-only messages and ignore unexpected photo/voice properties. No media upload callable exports exist.
- Firestore chat client writes remain denied; App Check remains disabled.

## Findings / release blockers
1. Account rotation bypasses per-conversation limits. Before enabling live chat, add abuse safeguards spanning guest identities, such as App Check, durable rate limits, quotas and monitoring.
2. Existing message cooldown and quotas are not a complete spam defence. Test with real Firestore transactions under simultaneous load and retries.
3. Voice/photo uploads are not implemented; ignoring payload fields is not the same as validating and rejecting them. Introduce dedicated upload authorization, storage security rules, file size/MIME validation, retention and malware scanning before enabling attachments.
4. Firebase Functions callable App Check enforcement is currently false.
5. Tests intentionally enable the chat environment variable **only inside the synthetic test process**; CI and deployed configurations are not modified.
6. Existing production deployment state is not verified here.

No real appointments, customer data, bookings, messaging, publishing, payments or production resources are accessed or changed.
