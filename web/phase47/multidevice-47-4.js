"use strict";
// Synthetic browser/Android read-only coordination. No production SDK, network or writes.
const {createMultiDeviceGate}=require("../phase46/multidevice-46-4");
const {assessLaunchGaps}=require("../phase46/readiness-gaps-46-1");
const deny=reason=>Object.freeze({status:"UNAVAILABLE",reason,accessGranted:false,stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
const valid=x=>typeof x==="string"&&/^synthetic-[a-z0-9-]{3,60}$/.test(x);
function createStagingConsistencyPreparation({read,now=Date.now,maxAgeMs=300000}={}){
 if(typeof read!=="function")throw TypeError("injected_read_required");
 const gate=createMultiDeviceGate({read,now,maxAgeMs});
 let owner=null,epoch=0,active=true,online=true;
 const sessions=new Map();
 async function refresh({device,uid,identity}={}){
  if(!active||!online)return deny("offline_or_stopped");
  if(!["browser","android"].includes(device)||!valid(uid)||!identity||identity.uid!==uid||identity.emailVerified!==true||identity.revocationVerified!==true||identity.appCheckVerified!==true||identity.sessionActive!==true||identity.online!==true)return deny("identity_denied");
  if(owner!==null&&owner!==uid){sessions.clear();gate.switchAccount(uid);owner=uid;epoch++;return deny("account_switch_revalidation_required")}
  if(owner===null)owner=uid;
  const seq=epoch;
  const r=await gate.refresh({device,uid,identity});
  if(!active||!online||seq!==epoch||owner!==uid)return deny("stale_session");
  if(r.status!=="ISOLATED_CONSISTENT_READ_ONLY"){sessions.clear();return deny(r.reason||"read_denied")}
  const peer=sessions.get(device==="browser"?"android":"browser");
  if(peer&&peer.revision!==r.revision){sessions.clear();return deny("revision_conflict")}
  if(assessLaunchGaps().openCount!==7)return deny("launch_gate_changed");
  const result=Object.freeze({status:"SYNTHETIC_DEVICE_CONSISTENCY_ONLY",device,revision:r.revision,accessGranted:false,stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
  sessions.set(device,result);
  return result;
 }
 function clear(reason){epoch++;sessions.clear();return deny(reason)}
 return Object.freeze({refresh,snapshot:device=>sessions.get(device)||deny("revalidation_required"),offline(){online=false;gate.offline();return clear("offline")},reconnect(){online=true;gate.reconnect();return clear("revalidation_required")},switchAccount(uid=null){owner=uid;gate.switchAccount(uid);return clear("account_switch_revalidation_required")},invalidate(){gate.offline();return clear("session_invalidated")},stop(){active=false;gate.stop();return clear("stopped")},accessGranted:false,stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
}
module.exports=Object.freeze({createStagingConsistencyPreparation});
