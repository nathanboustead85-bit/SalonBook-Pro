# Boustio Phase 26.7 — Real Firestore emulator chat concurrency

## What is exercised
Unlike Phase 26.6's synthetic transaction queue, this suite executes the **actual chat callable handler bodies** with the real Firebase Admin Firestore SDK pointed exclusively at a local Firestore emulator in the `demo-boustio-phase267` project. Two simultaneous requests test Firestore transaction contention, retries, duplicate conversation protection, cooldowns and quota boundaries. Anonymous identity is simulated at the callable handler boundary, **not** authenticated through Firebase Auth HTTP transport.

## Test scenarios
- Chat disabled by default; no conversation created.
- Concurrent start attempts for the same guest produce one conversation and one initial message.
- Distinct anonymous identities have separate conversations.
- Concurrent sends respect five-second cooldown and do not double-write.
- At the 99/100 message boundary, only one concurrent send can succeed; at 100 both are rejected.
- Cross-customer send/read attempts are rejected.
- A new anonymous identity can start another conversation, demonstrating account-rotation abuse risk.

## Launch blockers and limitations
1. **Anonymous account rotation bypasses per-conversation quotas.** Add cross-account durable abuse limits, App Check, monitoring and appropriate rate limiting before enabling live chat.
2. **App Check is currently disabled** for chat callable exports.
3. The suite uses the real Firestore emulator and Admin SDK, but invokes handler callbacks directly with simulated auth. It does not prove Firebase Auth token validation, HTTP callable protocol, Cloud Functions emulator, production IAM or deployed security configuration.
4. Emulator transactions do not guarantee production performance or contention characteristics. Keep load testing and monitoring as separate release gates.
5. Voice/photo attachments remain disabled; dedicated upload endpoints, validation and Storage security rules require later implementation.
6. The suite deliberately sets `BOUSTIO_CHAT_ENABLED=true` only inside the local test process for positive-path testing. CI starts with the flag false; no production environment is changed.

**Safety:** No production deployment, credentials, live bookings, live chat, or existing Android appointments are touched.
