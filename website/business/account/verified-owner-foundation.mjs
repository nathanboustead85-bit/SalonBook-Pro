// Phase 19.1: verified owner session and account isolation foundation.
// Intentionally offline: no Firebase SDK import, storage, network or real registration.
import {requireVerifiedOwner} from "../register/firebase-auth-foundation.mjs";
export const LIVE_ACCOUNT_INTEGRATION_ENABLED=false;
export const PUBLIC_REGISTRATION_ENABLED=false;
export const CUSTOMER_BOOKINGS_ENABLED=false;
export const ACCOUNT_WRITES_ENABLED=false;
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function verifiedIdentity(user) {
 const uid=requireVerifiedOwner(user);
 if(!UID.test(uid))throw new Error("Invalid verified owner identity.");
 const email=typeof user.email==="string"?user.email.trim().toLowerCase():"";
 if(email.length>254||!EMAIL.test(email))throw new Error("Verified owner email required.");
 return Object.freeze({uid,email,emailVerified:true});
}
export function verifiedOwnerContext(user, expectedUid=null) {
 const owner=verifiedIdentity(user);
 if(expectedUid!==null&&expectedUid!==owner.uid)throw new Error("Cross-owner access denied.");
 return owner;
}
export function accountDocumentPath(user,kind) {
 const {uid}=verifiedOwnerContext(user);
 const suffix={profile:["business","profile"],draft:["onboardingDrafts","setup-v1"],completion:["onboardingCompletion","setup-v1"]}[kind];
 if(!suffix)throw new Error("Unknown account document.");
 return Object.freeze(["users",uid,...suffix]);
}
export function assertOwnerDocument(user,record) {
 const {uid}=verifiedOwnerContext(user);
 if(!record||typeof record!=="object"||Array.isArray(record))throw new Error("Invalid account document.");
 if(record.ownerId!==uid&&record.businessId!==uid)throw new Error("Cross-owner access denied.");
 if(record.acceptingBookings!==false||record.published===true)throw new Error("Account booking/publishing state is unsafe.");
 return structuredClone(record);
}
export function verifyAuthSession(user,token) {
 const owner=verifiedOwnerContext(user);
 if(!token||token.uid!==owner.uid||token.email_verified!==true)throw new Error("Verified token required.");
 if(typeof token.email!=="string"||token.email.trim().toLowerCase()!==owner.email)throw new Error("Token email mismatch.");
 return owner;
}
export async function loadOwnerAccount() {
 if(!LIVE_ACCOUNT_INTEGRATION_ENABLED)throw new Error("Live business accounts are disabled.");
 throw new Error("Trusted account integration not configured.");
}
export async function writeOwnerAccount() {
 if(!ACCOUNT_WRITES_ENABLED)throw new Error("Business account writes are disabled.");
 throw new Error("Trusted account persistence not configured.");
}
