// Phase 19.7: offline, owner-isolated dashboard sync reducer.
// No Firebase listeners, writes, network, storage, or live data migration.
import {SESSION_STATES} from "../account/session-foundation.mjs";
export const LIVE_DASHBOARD_SYNC_ENABLED=false;
export const PUBLIC_REGISTRATION_ENABLED=false;
export const CUSTOMER_BOOKINGS_ENABLED=false;
export const DASHBOARD_WRITES_ENABLED=false;
export const SYNC_STATES=Object.freeze({EMPTY:"empty",CURRENT:"current",CONFLICT:"conflict"});
export function beginDashboardSync(account) {
 if(!account||account.status!==SESSION_STATES.READY||!account.owner||
    !Number.isSafeInteger(account.revision)||account.revision<0)
  throw new Error("Verified owner session required.");
 return Object.freeze({ownerUid:account.owner.uid,sessionRevision:account.revision,
  serverVersion:0,status:SYNC_STATES.EMPTY,profile:null});
}
function checkAccount(account,state) {
 if(!account||account.status!==SESSION_STATES.READY||!account.owner||
    account.owner.uid!==state.ownerUid||account.revision!==state.sessionRevision)
  throw new Error("Stale or cross-owner dashboard session rejected.");
}
export function applyDashboardSnapshot(account,state,snapshot) {
 if(!state||!Number.isSafeInteger(state.serverVersion)||state.serverVersion<0)
  throw new Error("Invalid dashboard sync state.");
 checkAccount(account,state);
 if(!snapshot||snapshot.ownerUid!==state.ownerUid||
    !Number.isSafeInteger(snapshot.version)||snapshot.version<1)
  throw new Error("Invalid or cross-owner dashboard snapshot.");
 if(snapshot.version<state.serverVersion)return state; // Late device response.
 if(snapshot.version===state.serverVersion) {
  // Same version with different data is an unresolved conflict, never overwrite.
  if(JSON.stringify(snapshot.profile)!==JSON.stringify(state.profile))
   return Object.freeze({...state,status:SYNC_STATES.CONFLICT});
  return state;
 }
 const p=snapshot.profile;
 if(!p||typeof p!=="object"||Array.isArray(p)||p.businessId!==state.ownerUid||
    p.acceptingBookings!==false||p.published===true||p.schemaVersion!==1)
  throw new Error("Unsafe or cross-owner dashboard profile rejected.");
 return Object.freeze({...state,serverVersion:snapshot.version,
  status:SYNC_STATES.CURRENT,profile:structuredClone(p)});
}
export function prepareDashboardEdit(account,state,expectedServerVersion) {
 checkAccount(account,state);
 if(state.status!==SYNC_STATES.CURRENT||!state.profile)
  throw new Error("Current dashboard profile required.");
 if(expectedServerVersion!==state.serverVersion)
  throw new Error("Stale dashboard edit rejected.");
 return Object.freeze({ownerUid:state.ownerUid,sessionRevision:state.sessionRevision,
  expectedServerVersion:state.serverVersion,writeEnabled:false});
}
export async function subscribeToDashboardSync() {
 if(!LIVE_DASHBOARD_SYNC_ENABLED)throw new Error("Live dashboard sync is disabled.");
 throw new Error("Trusted Firebase sync adapter not configured.");
}
export async function commitDashboardEdit() {
 if(!DASHBOARD_WRITES_ENABLED)throw new Error("Dashboard writes are disabled.");
 throw new Error("Trusted transaction adapter not configured.");
}
