# Phase 59.3 — Current messaging security implementation verification

## Directly inspected code
- `firestore.rules` defines `businesses/{businessId}/conversations/{conversationId}` and nested `messages/{messageId}`.
- Both allow reads only to a verified business owner. All client create/update/delete operations are denied. The default catch-all denies reads and writes.
- `.github/workflows/chat-emulator.yml` references `functions/package.json` and `functions/tests/chat-emulator-smoke.test.js`, neither of which exists on this phase branch. **The existing chat emulator smoke workflow is not runnable as written.** Do not count it as independent runtime evidence.
- The Phase 59.3 tests verify these source contracts only; they do not run Firebase emulators, upload attachments or prove cross-account isolation at runtime.

## Security gaps and next engineering work
1. Create an isolated, executable Firebase emulator test harness that tests verified owner reads, cross-owner denial, unauthenticated denial and all client writes denied.
2. Design and test customer-side conversation access without exposing other customers or businesses.
3. Implement backend-mediated chat with rate limits, anti-abuse controls, media validation, photo/voice storage isolation, 60-second voice limit and notifications.
4. Independently review security rules and real staging evidence before any gate can close.
5. Confirm installed Android 11.13 package identity, versionCode and signing fingerprint before any update attempt.

No live messaging, Firebase rules deployment, Android installation, local appointment writes or production restore occurs in Phase 59.3. G1–G7 remain OPEN.
