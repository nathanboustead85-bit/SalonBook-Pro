// Phase 18.3: secure, offline-only profile creation foundation.
// Deliberately not imported by the public registration page.
import { requireVerifiedOwner } from "./firebase-auth-foundation.mjs";
export const PUBLIC_PROFILE_CREATION_ENABLED = false;
const CATEGORIES = Object.freeze(["salon","barber","nails","beauty","wellness"]);
export function buildPrivateBusinessProfile(user, draft, now) {
  const uid = requireVerifiedOwner(user);
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) throw new Error("Invalid business details.");
  const name = typeof draft.name === "string" ? draft.name.trim() : "";
  const slug = typeof draft.slug === "string" ? draft.slug.trim().toLowerCase() : "";
  const category = draft.category;
  const email = typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
  if (name.length < 2 || name.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
      slug.length < 3 || slug.length > 50 || !CATEGORIES.includes(category) ||
      email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Invalid business details.");
  }
  if (!now) throw new Error("Server timestamp required.");
  // Ignore caller-supplied owner, permissions, booking status and timestamps.
  return Object.freeze({
    businessId: uid, name, slug, category, email,
    phone: "", address: "", description: "",
    acceptingBookings: false, schemaVersion: 1, updatedAt: now
  });
}
export async function createPrivateBusinessProfile({user,draft,db,sdk}={}) {
  if (!PUBLIC_PROFILE_CREATION_ENABLED) throw new Error("Business profile creation is not enabled.");
  const uid=requireVerifiedOwner(user);
  if (!db || typeof sdk?.doc !== "function" || typeof sdk?.setDoc !== "function" ||
      typeof sdk?.serverTimestamp !== "function") throw new Error("Firestore unavailable.");
  const profile=buildPrivateBusinessProfile(user,draft,sdk.serverTimestamp());
  // UID-derived path; never trust a businessId supplied by the client.
  const ref=sdk.doc(db,"users",uid,"business","profile");
  await sdk.setDoc(ref,profile);
  return {businessId:uid,acceptingBookings:false};
}
