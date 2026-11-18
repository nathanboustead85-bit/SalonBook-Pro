// Phase 19.3 — offline owner-only business profile read contract.
// No Firebase imports, SDK calls, storage or network. Production reads stay disabled.
import {accountDocumentPath,assertOwnerDocument} from "./verified-owner-foundation.mjs";
import {requireReadySession} from "./session-foundation.mjs";
export const LIVE_PROFILE_READS_ENABLED=false;
export const PUBLIC_REGISTRATION_ENABLED=false;
export const CUSTOMER_BOOKINGS_ENABLED=false;
export const PROFILE_WRITES_ENABLED=false;
export const PROFILE_STATES=Object.freeze({FOUND:"found",MISSING:"missing"});
export function ownerProfilePath(session) {
 const owner=requireReadySession(session);
 return accountDocumentPath(owner,"profile");
}
export function interpretProfileSnapshot(session,snapshot) {
 const owner=requireReadySession(session);
 if(!snapshot||typeof snapshot.exists!=="function"||typeof snapshot.data!=="function")
  throw new Error("Invalid profile snapshot.");
 // A missing record is not an error, but must never create a profile automatically.
 if(!snapshot.exists())return Object.freeze({state:PROFILE_STATES.MISSING,profile:null});
 const record=assertOwnerDocument(owner,snapshot.data());
 if(record.businessId!==owner.uid)throw new Error("Profile business identity mismatch.");
 if(record.schemaVersion!==1)throw new Error("Unsupported profile schema.");
 return Object.freeze({state:PROFILE_STATES.FOUND,profile:record});
}
export async function readOwnerBusinessProfile() {
 if(!LIVE_PROFILE_READS_ENABLED)throw new Error("Live profile reads are disabled.");
 throw new Error("Trusted Firebase profile reader not configured.");
}
