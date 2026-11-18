// Phase 19.8: offline dashboard interruption and reconnection state machine.
// No live Firebase listeners, database writes, timers, storage or deployment.
import {SESSION_STATES} from "../account/session-foundation.mjs";
import {beginDashboardSync,applyDashboardSnapshot,SYNC_STATES} from "./sync-foundation.mjs";
export const LIVE_RECOVERY_ENABLED=false;
export const PUBLIC_REGISTRATION_ENABLED=false;
export const CUSTOMER_BOOKINGS_ENABLED=false;
export const DASHBOARD_WRITES_ENABLED=false;
export const RECOVERY_STATES=Object.freeze({CONNECTED:"connected",INTERRUPTED:"interrupted",RECONNECTING:"reconnecting",CONFLICT:"conflict"});
function ownerCheck(account,state) {
 if(!account||account.status!==SESSION_STATES.READY||!account.owner||
    account.owner.uid!==state.ownerUid||account.revision!==state.sessionRevision)
  throw new Error("Stale or cross-owner recovery session rejected.");
}
export function startDashboardRecovery(account) {
 const sync=beginDashboardSync(account);
 return Object.freeze({...sync,connection:RECOVERY_STATES.CONNECTED,epoch:0});
}
export function interruptDashboard(account,state) {
 ownerCheck(account,state);
 return Object.freeze({...state,connection:RECOVERY_STATES.INTERRUPTED,
  epoch:state.epoch+1});
}
export function reconnectDashboard(account,state) {
 ownerCheck(account,state);
 if(state.connection!==RECOVERY_STATES.INTERRUPTED)
  throw new Error("Dashboard must be interrupted before reconnecting.");
 return Object.freeze({...state,connection:RECOVERY_STATES.RECONNECTING,
  epoch:state.epoch+1});
}
export function receiveRecoverySnapshot(account,state,epoch,snapshot) {
 ownerCheck(account,state);
 if(!Number.isSafeInteger(epoch)||epoch!==state.epoch)
  throw new Error("Stale dashboard connection response rejected.");
 if(state.connection!==RECOVERY_STATES.CONNECTED&&state.connection!==RECOVERY_STATES.RECONNECTING)
  throw new Error("Dashboard connection is interrupted.");
 const next=applyDashboardSnapshot(account,state,snapshot);
 if(next.status===SYNC_STATES.CONFLICT)
  return Object.freeze({...next,connection:RECOVERY_STATES.CONFLICT});
 return Object.freeze({...next,connection:RECOVERY_STATES.CONNECTED});
}
export function canDisplayRecoveredProfile(account,state) {
 try {
  ownerCheck(account,state);
  return state.connection===RECOVERY_STATES.CONNECTED&&
    state.status===SYNC_STATES.CURRENT&&state.profile!==null;
 } catch {return false;}
}
export function clearDashboardRecovery() {
 // On sign-out, expiry or owner switch the caller must discard the old state.
 return Object.freeze({ownerUid:null,sessionRevision:null,serverVersion:0,
  status:SYNC_STATES.EMPTY,profile:null,connection:RECOVERY_STATES.INTERRUPTED,epoch:0});
}
export async function connectLiveDashboardRecovery() {
 if(!LIVE_RECOVERY_ENABLED)throw new Error("Live dashboard recovery is disabled.");
 throw new Error("Trusted Firebase recovery adapter not configured.");
}
