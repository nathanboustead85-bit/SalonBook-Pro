// Phase 22.1: opt-in business dashboard integration foundation.
// No Firebase app initialization, deployment, login UI or production activation.
import {createDashboardSessionController} from "./session-integration-foundation.mjs";
import {createFirebaseBrowserSdkAdapter} from "./firebase-browser-sdk-adapter.mjs";
export const PUBLIC_REGISTRATION_ENABLED=false;
export const CUSTOMER_BOOKINGS_ENABLED=false;
export const LIVE_DASHBOARD_ENABLED=false;
export const DASHBOARD_FIREBASE_INTEGRATION_ENABLED=false;
const allowed=new Set(["signed-out","checking","connecting","unverified","ready","empty","invalid","interrupted"]);
export function createBusinessDashboardFirebaseFoundation({auth,firestore,authSdk,firestoreSdk,projectId,expectedProjectId,onState}){
 if(typeof onState!=="function")throw Error("Explicit state callback required");
 const adapter=createFirebaseBrowserSdkAdapter({auth,firestore,authSdk,firestoreSdk,projectId,expectedProjectId});
 let started=false,stopped=false,sequence=0;
 let state=Object.freeze({status:"signed-out",ownerUid:null,profile:null,bookingsEnabled:false,registrationEnabled:false});
 const publish=view=>{
  if(stopped)return;
  if(!allowed.has(view.status))throw Error("Unexpected session state");
  // Do not expose mutable Firestore objects or stale business profiles.
  const profile=view.status==="ready"&&view.profile&&view.profile.businessId===view.ownerUid&&
    view.profile.acceptingBookings===false&&view.profile.published!==true
    ?Object.freeze({businessId:view.ownerUid,name:String(view.profile.name??""),category:String(view.profile.category??"")})
    :null;
  const status=view.status==="ready"&&!profile?"invalid":view.status;
  state=Object.freeze({status,ownerUid:status==="signed-out"?null:view.ownerUid??null,profile,
   bookingsEnabled:false,registrationEnabled:false,sequence:++sequence});
  onState(state);
 };
 const session=createDashboardSessionController({...adapter,onView:publish});
 return Object.freeze({
  start(){if(started||stopped)throw Error("Dashboard foundation already started or stopped");started=true;session.start(auth);},
  reconnect(){return !stopped&&started?session.reconnect():false;},
  clear(){if(!stopped)session.clear();},
  stop(){if(stopped)return;stopped=true;session.stop();state=Object.freeze({status:"signed-out",ownerUid:null,profile:null,bookingsEnabled:false,registrationEnabled:false});},
  get state(){return state;}
 });
}
