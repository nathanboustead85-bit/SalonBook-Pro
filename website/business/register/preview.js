// Phase 18: deliberately no Firebase initialization, network calls or storage.
export const REGISTRATION_ENABLED = false;
export const BUSINESS_CATEGORIES = Object.freeze(["salon","barber","nails","beauty","wellness"]);
export function validateBusinessDraft(draft) {
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) return false;
  const name=typeof draft.businessName==="string"?draft.businessName.trim():"";
  const email=typeof draft.email==="string"?draft.email.trim():"";
  return name.length>=2 && name.length<=100 &&
    BUSINESS_CATEGORIES.includes(draft.category) &&
    email.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
// No submit handler: this is an informational preview, not an account creation form.
