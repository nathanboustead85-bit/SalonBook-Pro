"use strict";
// Synthetic acceptance evidence, not actual Samsung device testing.
const {assessLaunchGaps}=require("./readiness-gaps-46-1");
const checks=Object.freeze([
 Object.freeze({id:"accessibility-labels",category:"accessibility",evidence:"TalkBack labels, roles and actions manually verified on Samsung"}),
 Object.freeze({id:"accessibility-focus",category:"accessibility",evidence:"Focus order, keyboard navigation and screen reader announcements"}),
 Object.freeze({id:"accessibility-contrast",category:"accessibility",evidence:"Text scaling, contrast and touch targets on device"}),
 Object.freeze({id:"offline-recovery",category:"recovery",evidence:"Airplane mode, reconnect and forced revalidation on Samsung"}),
 Object.freeze({id:"session-persistence",category:"session",evidence:"Background, force-stop and process recreation without leaking user state"}),
 Object.freeze({id:"signout-isolation",category:"session",evidence:"Sign-out and account switch clear sensitive state"}),
 Object.freeze({id:"multi-device-revisions",category:"multi-device",evidence:"Browser/Android revision mismatch and recovery sign-off"}),
 Object.freeze({id:"multi-device-owner",category:"multi-device",evidence:"Cross-owner access denied across independent sessions"})
]);
const denied=reason=>Object.freeze({status:"ACCEPTANCE_PENDING",reason,deviceSignedOff:false,stagingApproved:false,productionReady:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
function createSamsungAcceptance({read,now=Date.now}={}){
 if(typeof read!=="function"||typeof now!=="function")throw TypeError("synthetic_read_dependency_required");
 let active=true,online=true,epoch=0,owner=null,state=denied("not_started"),highWater=0;
 const clear=reason=>{epoch++;state=denied(reason);return state};
 async function verify({uid,identity}={}){
  if(!active||!online)return denied("offline_or_stopped");
  if(typeof uid!=="string"||!/^synthetic-[a-z0-9-]{3,60}$/.test(uid)||!identity||identity.uid!==uid||identity.emailVerified!==true||identity.sessionActive!==true)return clear("identity_denied");
  if(owner!==uid){owner=uid;highWater=0;clear("account_changed")}
  const seq=++epoch;state=denied("revalidating");
  try{
   const d=await read(uid);
   if(!active||!online||seq!==epoch||owner!==uid)return denied("stale_response");
   if(!d||d.ownerId!==uid||d.acceptingBookings!==false||!Number.isSafeInteger(d.revision)||d.revision<1||d.revision<highWater||!Number.isSafeInteger(d.updatedAt)||d.updatedAt>now()+30000||now()-d.updatedAt>300000)return clear("integrity_denied");
   if(assessLaunchGaps().openCount!==7)return clear("launch_gate_changed");
   highWater=d.revision;
   state=Object.freeze({status:"SYNTHETIC_SAMSUNG_PRECHECK_PASSED",revision:d.revision,deviceSignedOff:false,stagingApproved:false,productionReady:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
   return state;
  }catch{return clear("read_unavailable")}
 }
 return Object.freeze({verify,snapshot:()=>state,offline(){online=false;return clear("offline")},reconnect(){online=true;return clear("revalidation_required")},signOut(){owner=null;highWater=0;return clear("signed_out")},switchAccount(){owner=null;highWater=0;return clear("account_changed")},stop(){active=false;owner=null;return clear("stopped")},deviceSignedOff:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
}
function acceptanceMatrix(){return Object.freeze({status:"MANUAL_SAMSUNG_SIGNOFF_REQUIRED",checks,openCount:assessLaunchGaps().openCount,deviceSignedOff:false,stagingApproved:false,productionReady:false,canBook:false,canPay:false,canMessage:false,canDeploy:false})}
module.exports=Object.freeze({createSamsungAcceptance,acceptanceMatrix});
