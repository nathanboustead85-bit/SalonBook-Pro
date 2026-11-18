# Boustio Phase 19.1 — Verified Business Account Integration Readiness

**Release decision: NO-GO.** Phase 19.1 adds an offline owner-identity and account-isolation contract, **not** live authentication or account data persistence.

## Foundation implemented
- Verified Firebase-style user and token claims must match the same UID and verified email.
- Account document paths are allowlisted and derived exclusively from verified UID.
- Cross-owner documents, unsafe booking flags, invalid identities and mismatched token claims are rejected.
- No Firebase SDK initialization, external network calls, local/session storage or Firestore writes in the new module.
- Explicit disabled gates for live account integration, public registration, account writes and customer bookings.
- Automated offline tests for identity, owner isolation, safe cloning, path validation, security rule expectations and emulator configuration.
- Existing Android appointment storage and records are not accessed or changed.

## Emulator-ready security test matrix (NOT yet executed against Firebase emulators)
| Scenario | Expected outcome |
| --- | --- |
| Unauthenticated owner read | DENY |
| Unverified-email owner read | DENY |
| Verified owner reads own allowed profile | ALLOW under existing rule |
| Verified owner reads another UID's profile | DENY |
| Any client reads/writes onboarding draft or completion marker | DENY |
| Client attempts to set acceptingBookings true | DENY |
| Client attempts public catalogue write | DENY |
| Concurrent onboarding completion attempts | At most one create-only trusted transaction |
| Legacy Android booking migration and lock reconciliation | No lost or duplicate appointments |

The Phase 19.1 test suite checks static Firestore rules and emulator configuration; it **does not** execute live Firebase emulator security rules. Real emulator execution and integration tests are mandatory before enabling accounts.

## Outstanding work
1. Implement Firebase Auth SDK initialization behind explicit approval and secure verified-session refresh.
2. Build owner-scoped account reads/writes, validate server token claims and use Firestore emulator tests for positive and negative rules cases.
3. Design trusted transactional onboarding completion and idempotency.
4. Confirm account recovery, billing safeguards, rate limiting, logging and privacy retention.
5. Preserve and reconcile existing legacy Android bookings before activating customer bookings.
6. Perform staged end-to-end Samsung/browser testing and production deployment review.

**No deployment. No public registration. No customer bookings. No changes to original Android appointments.**
