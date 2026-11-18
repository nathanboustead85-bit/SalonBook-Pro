// Phase 18.7: offline-only onboarding completion gate.
// Completion is a review decision, never a booking/publishing operation.
import {requireVerifiedOwner} from "../register/firebase-auth-foundation.mjs";
import {validateSetup, DAYS} from "./enhanced-draft.mjs";
import {recoverDraft,ownerDraftPath,DRAFT_SCHEMA_VERSION} from "./save-resume-foundation.mjs";

export const ONBOARDING_COMPLETION_ENABLED = false;
export const PUBLIC_REGISTRATION_ENABLED = false;
export const CUSTOMER_BOOKINGS_ENABLED = false;
export const ONBOARDING_STATUS = Object.freeze({DRAFT:"draft",READY:"ready-for-review",COMPLETE:"complete"});

function safeUid(user) {
  const uid=requireVerifiedOwner(user);
  ownerDraftPath(user); // Also rejects invalid path components.
  return uid;
}
export function completionRecordPath(user) {
  return Object.freeze(["users",safeUid(user),"onboardingCompletion","setup-v1"]);
}
export function validateCompletion(user, draft, existingCompletion=null) {
  const uid=safeUid(user);
  if(existingCompletion!==null && existingCompletion!==undefined) {
    // Fail closed on any existing completion record, including malformed records.
    throw new Error("Onboarding has already been completed or reserved.");
  }
  const recovered=recoverDraft(user,draft);
  if(recovered.completedStep!==4) throw new Error("All onboarding steps must be completed.");
  const setup=recovered.setup;
  if(!validateSetup(setup)) throw new Error("Business setup is incomplete.");
  if(DAYS.some(day=>!Object.hasOwn(setup.week,day))) throw new Error("Weekly hours are incomplete.");
  const normalizedNames=setup.services.map(s=>s.name.trim().toLocaleLowerCase("en-GB"));
  if(new Set(normalizedNames).size!==normalizedNames.length) throw new Error("Duplicate services are not allowed.");
  const staffNames=setup.staff.map(s=>s.name.trim().toLocaleLowerCase("en-GB"));
  if(new Set(staffNames).size!==staffNames.length) throw new Error("Duplicate staff members are not allowed.");
  return Object.freeze({
    ownerId:uid,
    schemaVersion:DRAFT_SCHEMA_VERSION,
    status:ONBOARDING_STATUS.READY,
    completedStep:4,
    servicesCount:setup.services.length,
    staffCount:setup.staff.length,
    acceptingBookings:false,
    published:false
  });
}

// Pure idempotency decision for future trusted transactional server logic.
// Never use a client-side read-then-write check to enforce uniqueness.
export function assessCompletionAttempt(user,draft,existingCompletion) {
  return validateCompletion(user,draft,existingCompletion);
}
export async function completeOnboarding() {
  // No SDK or Firestore call: requires a separately reviewed backend transaction
  // with a create-only completion marker and verified-owner authentication.
  if(!ONBOARDING_COMPLETION_ENABLED) throw new Error("Onboarding completion is not enabled.");
  throw new Error("Trusted transactional completion backend is not configured.");
}
