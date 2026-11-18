// Phase 19.6 — verified owner dashboard data connection contract (offline).
// No Firebase SDK, API calls, persistence or public account access.
import {SESSION_STATES} from "../account/session-foundation.mjs";
import {interpretProfileSnapshot,PROFILE_STATES} from "../account/profile-read-foundation.mjs";
import {dashboardModel} from "./dashboard.mjs";
export const LIVE_DASHBOARD_CONNECTION_ENABLED=false;
export const PUBLIC_REGISTRATION_ENABLED=false;
export const CUSTOMER_BOOKINGS_ENABLED=false;
export const DASHBOARD_STATES=Object.freeze({SIGNED_OUT:"signed-out",LOADING:"loading",EMPTY:"empty",READY:"ready",INVALID:"invalid-session",ERROR:"error"});
export function beginOwnerDashboard(account) {
 if(!account||account.status!==SESSION_STATES.READY||!account.owner||!Number.isSafeInteger(account.revision))
  return Object.freeze({state:DASHBOARD_STATES.SIGNED_OUT,ownerUid:null,revision:null,data:null});
 return Object.freeze({state:DASHBOARD_STATES.LOADING,ownerUid:account.owner.uid,revision:account.revision,data:null});
}
export function resolveOwnerDashboard(account,request,snapshot) {
 if(!account||account.status!==SESSION_STATES.READY||!account.owner)
  return Object.freeze({state:DASHBOARD_STATES.SIGNED_OUT,ownerUid:null,revision:null,data:null});
 if(!request||request.state!==DASHBOARD_STATES.LOADING||request.ownerUid!==account.owner.uid||request.revision!==account.revision)
  throw new Error("Stale or cross-owner dashboard response rejected.");
 const session={state:SESSION_STATES.READY,owner:account.owner};
 const result=interpretProfileSnapshot(session,snapshot);
 if(result.state===PROFILE_STATES.MISSING)
  return Object.freeze({state:DASHBOARD_STATES.EMPTY,ownerUid:account.owner.uid,revision:account.revision,data:null});
 const p=result.profile;
 // Never substitute demo salon details for an authenticated business.
 const data=Object.freeze({business:p.name,category:p.category||"Not set",owner:account.owner.email,
  services:[],staff:[],hours:{},bookingStatus:"Disabled",registrationStatus:"Disabled",
  publishingStatus:"Disabled",isDemo:false,profileOnly:true});
 return Object.freeze({state:DASHBOARD_STATES.READY,ownerUid:account.owner.uid,revision:account.revision,data});
}
export function dashboardSummary(view) {
 if(!view||view.state!==DASHBOARD_STATES.READY||!view.data)
  throw new Error("Verified dashboard data required.");
 // Existing demo dashboardModel is deliberately not called: it labels everything as demo.
 return Object.freeze({...view.data,progress:25,checks:[true,false,false,false]});
}
export async function connectFirebaseOwnerDashboard() {
 if(!LIVE_DASHBOARD_CONNECTION_ENABLED)throw new Error("Live dashboard connections are disabled.");
 throw new Error("Trusted dashboard adapter not configured.");
}
