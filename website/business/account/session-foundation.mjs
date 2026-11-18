// Phase 19.2: fail-closed Firebase owner session evaluation and recovery.
// Pure functions; no SDK imports, persistence, network calls or listeners.
import {verifiedOwnerContext,verifyAuthSession} from "./verified-owner-foundation.mjs";
export const LIVE_SESSION_RECOVERY_ENABLED=false;
export const PUBLIC_REGISTRATION_ENABLED=false;
export const CUSTOMER_BOOKINGS_ENABLED=false;
export const SESSION_STATES=Object.freeze({SIGNED_OUT:"signed-out",UNVERIFIED:"email-verification-required",READY:"verified-preview",INVALID:"invalid-session"});
export function evaluateOwnerSession(user,token,expectedUid=null) {
 if(!user)return Object.freeze({state:SESSION_STATES.SIGNED_OUT,owner:null});
 if(user.emailVerified!==true)return Object.freeze({state:SESSION_STATES.UNVERIFIED,owner:null});
 try {
  const owner=verifyAuthSession(user,token);
  verifiedOwnerContext(user,expectedUid);
  return Object.freeze({state:SESSION_STATES.READY,owner});
 } catch {
  return Object.freeze({state:SESSION_STATES.INVALID,owner:null});
 }
}
export function recoverOwnerSession(snapshot,{expectedUid=null}={}) {
 // Snapshot must come from Firebase Auth's current verified user and fresh token claims,
 // never from localStorage or caller-supplied profile fields.
 if(!snapshot||typeof snapshot!=="object"||Array.isArray(snapshot))
  return Object.freeze({state:SESSION_STATES.SIGNED_OUT,owner:null});
 return evaluateOwnerSession(snapshot.user,snapshot.token,expectedUid);
}
export function requireReadySession(session,expectedUid=null) {
 if(!session||session.state!==SESSION_STATES.READY||!session.owner)
  throw new Error("Verified Firebase session required.");
 const owner=verifiedOwnerContext(session.owner,expectedUid);
 return owner;
}
export async function resumeFirebaseOwnerSession() {
 if(!LIVE_SESSION_RECOVERY_ENABLED)throw new Error("Live session recovery is disabled.");
 throw new Error("Firebase session adapter not configured.");
}
