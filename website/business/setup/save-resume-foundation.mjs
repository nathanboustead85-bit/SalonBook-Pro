// Phase 18.6 — disabled, owner-bound onboarding draft storage foundation.
// No Firebase SDK imports, network access, browser storage or automatic persistence.
import {requireVerifiedOwner} from "../register/firebase-auth-foundation.mjs";
import {validateSetup} from "./enhanced-draft.mjs";

export const SAVE_RESUME_ENABLED = false;
export const DRAFT_SCHEMA_VERSION = 1;
export const DRAFT_STEPS = Object.freeze(["Business","Services","Hours","Staff","Review"]);
const DRAFT_ID="setup-v1";

export function ownerDraftPath(user) {
  const uid=requireVerifiedOwner(user);
  if(uid.includes("/")||uid==="."||uid===".."||uid.length>128)throw new Error("Invalid owner identity.");
  return Object.freeze(["users",uid,"onboardingDrafts",DRAFT_ID]);
}
export function createDraftEnvelope(user, setup, completedStep, updatedAt) {
  const uid=requireVerifiedOwner(user);
  if(!validateSetup(setup))throw new Error("Invalid setup draft.");
  if(!Number.isInteger(completedStep)||completedStep<0||completedStep>4)throw new Error("Invalid progress.");
  if(!updatedAt)throw new Error("Server timestamp required.");
  // Explicit field allowlist; discard caller-supplied owner, permissions and booking flags.
  const clean=structuredClone({
    name:setup.name.trim(),category:setup.category,contact:setup.contact.trim(),
    services:setup.services.map(s=>({name:s.name.trim(),price:String(s.price),duration:Number(s.duration)})),
    week:Object.fromEntries(Object.entries(setup.week).map(([day,h])=>[day,{closed:h.closed,open:h.open,close:h.close}])),
    staff:setup.staff.map(s=>({name:s.name.trim()}))
  });
  return {ownerId:uid,schemaVersion:DRAFT_SCHEMA_VERSION,completedStep,updatedAt,
    acceptingBookings:false,published:false,setup:clean};
}
export function recoverDraft(user, snapshot) {
  const uid=requireVerifiedOwner(user);
  if(!snapshot||snapshot.ownerId!==uid||snapshot.schemaVersion!==DRAFT_SCHEMA_VERSION||
     snapshot.acceptingBookings!==false||snapshot.published!==false||
     !Number.isInteger(snapshot.completedStep)||snapshot.completedStep<0||snapshot.completedStep>4||
     !validateSetup(snapshot.setup))throw new Error("Draft unavailable or invalid.");
  return {completedStep:snapshot.completedStep,setup:structuredClone(snapshot.setup)};
}
export async function saveDraft({user,setup,completedStep,db,sdk}={}) {
  if(!SAVE_RESUME_ENABLED)throw new Error("Save and resume is not enabled.");
  if(!db||typeof sdk?.doc!=="function"||typeof sdk?.setDoc!=="function"||
     typeof sdk?.serverTimestamp!=="function")throw new Error("Firestore unavailable.");
  const path=ownerDraftPath(user);
  const envelope=createDraftEnvelope(user,setup,completedStep,sdk.serverTimestamp());
  await sdk.setDoc(sdk.doc(db,...path),envelope);
  return {completedStep,stored:true};
}
export async function resumeDraft({user,db,sdk}={}) {
  if(!SAVE_RESUME_ENABLED)throw new Error("Save and resume is not enabled.");
  if(!db||typeof sdk?.doc!=="function"||typeof sdk?.getDoc!=="function")throw new Error("Firestore unavailable.");
  const snapshot=await sdk.getDoc(sdk.doc(db,...ownerDraftPath(user)));
  if(!snapshot.exists())return null;
  return recoverDraft(user,snapshot.data());
}
