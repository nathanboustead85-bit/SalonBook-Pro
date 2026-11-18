// Phase 19.4 — offline, owner-only business profile update validation.
// Produces a safe preview of an update. No Firebase SDK, writes or network.
import {requireReadySession} from "./session-foundation.mjs";
import {interpretProfileSnapshot,PROFILE_STATES} from "./profile-read-foundation.mjs";
export const LIVE_PROFILE_UPDATES_ENABLED=false;
export const PUBLIC_REGISTRATION_ENABLED=false;
export const CUSTOMER_BOOKINGS_ENABLED=false;
const ALLOWED=Object.freeze(["name","phone","address","description"]);
function cleanText(value,field,min,max) {
 if(typeof value!=="string")throw new Error("Invalid "+field+".");
 const result=value.trim();
 if(result.length<min||result.length>max||/[\u0000-\u001f\u007f]/.test(result))
  throw new Error("Invalid "+field+".");
 return result;
}
export function prepareOwnerProfileUpdate(session,snapshot,changes) {
 const owner=requireReadySession(session);
 const current=interpretProfileSnapshot(session,snapshot);
 if(current.state!==PROFILE_STATES.FOUND)throw new Error("Existing owner profile required.");
 if(!changes||typeof changes!=="object"||Array.isArray(changes))
  throw new Error("Invalid profile changes.");
 const keys=Object.keys(changes);
 if(keys.length===0)throw new Error("At least one profile change required.");
 for(const key of keys)if(!ALLOWED.includes(key))throw new Error("Protected or unknown profile field: "+key);
 const updates={};
 if(Object.hasOwn(changes,"name"))updates.name=cleanText(changes.name,"business name",2,100);
 if(Object.hasOwn(changes,"phone")) {
  const phone=cleanText(changes.phone,"phone",0,30);
  if(phone&&!/^\+?[0-9 ()-]{7,30}$/.test(phone))throw new Error("Invalid phone.");
  updates.phone=phone;
 }
 if(Object.hasOwn(changes,"address"))updates.address=cleanText(changes.address,"address",0,200);
 if(Object.hasOwn(changes,"description"))updates.description=cleanText(changes.description,"description",0,1000);
 const profile=Object.freeze({...current.profile,...updates,businessId:owner.uid,acceptingBookings:false,published:false});
 return Object.freeze({ownerUid:owner.uid,changes:Object.freeze(updates),profile});
}
export async function updateOwnerBusinessProfile() {
 if(!LIVE_PROFILE_UPDATES_ENABLED)throw new Error("Live profile updates are disabled.");
 throw new Error("Trusted Firebase update adapter not configured.");
}
