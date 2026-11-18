// Phase 19.5: offline account lifecycle and session-expiry safety.
// This is a pure, fail-closed state machine. No Firebase SDK, storage, or network.
import {evaluateOwnerSession,SESSION_STATES} from "./session-foundation.mjs";
export const LIVE_SESSION_LISTENERS_ENABLED=false;
export const PUBLIC_REGISTRATION_ENABLED=false;
export const CUSTOMER_BOOKINGS_ENABLED=false;
export const ACCOUNT_WRITES_ENABLED=false;
export const ACCOUNT_EVENTS=Object.freeze({RESTORE:"restore",SIGN_OUT:"sign-out",EXPIRE:"expire",SWITCH:"switch"});
export function emptyAccountState() {
 return Object.freeze({status:SESSION_STATES.SIGNED_OUT,owner:null,profile:null,revision:0});
}
function reset(status,revision) {
 return Object.freeze({status,owner:null,profile:null,revision});
}
export function transitionAccount(previous,event,payload={}) {
 if(!previous||!Number.isSafeInteger(previous.revision)||previous.revision<0)
  throw new Error("Invalid account lifecycle state.");
 if(!Object.values(ACCOUNT_EVENTS).includes(event))throw new Error("Unknown account event.");
 const revision=previous.revision+1;
 if(event===ACCOUNT_EVENTS.SIGN_OUT)return reset(SESSION_STATES.SIGNED_OUT,revision);
 if(event===ACCOUNT_EVENTS.EXPIRE)return reset(SESSION_STATES.INVALID,revision);
 if(event===ACCOUNT_EVENTS.SWITCH) {
  // Never retain previous owner's cached profile, even if new auth is pending.
  return reset(SESSION_STATES.SIGNED_OUT,revision);
 }
 const user=payload?.user??null;
 const token=payload?.token??null;
 const session=evaluateOwnerSession(user,token);
 if(session.state!==SESSION_STATES.READY)return reset(session.state,revision);
 // Restoring a different owner must invalidate all previous profile state.
 return Object.freeze({status:SESSION_STATES.READY,owner:session.owner,profile:null,revision});
}
export function attachOwnerProfile(state,profile,revision) {
 if(!state||state.status!==SESSION_STATES.READY||!state.owner)
  throw new Error("Verified owner session required.");
 if(revision!==state.revision)throw new Error("Stale account response rejected.");
 if(!profile||typeof profile!=="object"||Array.isArray(profile)||
    profile.businessId!==state.owner.uid||profile.acceptingBookings!==false||
    profile.published===true)
  throw new Error("Unsafe or cross-owner profile rejected.");
 return Object.freeze({...state,profile:structuredClone(profile)});
}
export async function subscribeToFirebaseSession() {
 if(!LIVE_SESSION_LISTENERS_ENABLED)throw new Error("Live Firebase session listeners are disabled.");
 throw new Error("Trusted session listener not configured.");
}
