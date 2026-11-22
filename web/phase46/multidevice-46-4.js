"use strict";
// Synthetic read-only browser/Android consistency gate; no SDK, network, writes or deployment.
const {assessLaunchGaps}=require("./readiness-gaps-46-1");
const deny=reason=>Object.freeze({status:"UNAVAILABLE",reason,revision:null,accessGranted:false,canBook:false,canPay:false,canMessage:false,canDeploy:false,stagingApproved:false});
const valid=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{1,80}$/.test(x);
function createMultiDeviceGate({read,now=Date.now,maxAgeMs=300000}={}){
 if(typeof read!=="function"||typeof now!=="function"||!Number.isSafeInteger(maxAgeMs)||maxAgeMs<1000||maxAgeMs>3600000)throw TypeError("isolated_dependencies_required");
 const devices=new Map();let epoch=0,active=true,online=true,owner=null,highest=0;
 const clear=reason=>{epoch++;devices.clear();return deny(reason)};
 async function refresh({device,uid,identity}={}){
  if(!active||!online)return deny("offline_or_stopped");
  if(!["browser","android"].includes(device)||!valid(uid)||!identity||identity.uid!==uid||identity.emailVerified!==true||identity.sessionActive!==true||identity.online!==true)return deny("unauthorized_device");
  if(owner!==uid){owner=uid;highest=0;clear("account_changed")}
  const seq=++epoch;devices.delete(device);
  try{
   const data=await read(uid,device);
   if(!active||!online||seq!==epoch||owner!==uid)return deny("stale_response");
   if(!data||data.ownerId!==uid||data.acceptingBookings!==false||!Number.isSafeInteger(data.revision)||data.revision<1||!Number.isSafeInteger(data.updatedAt)||data.updatedAt>now()+30000||now()-data.updatedAt>maxAgeMs)return deny("invalid_or_stale_data");
   if(data.revision<highest)return deny("revision_rollback");
   highest=Math.max(highest,data.revision);
   const peer=devices.get(device==="browser"?"android":"browser");
   if(peer&&peer.revision!==data.revision){devices.clear();return deny("cross_device_revision_conflict")}
   const result=Object.freeze({status:"ISOLATED_CONSISTENT_READ_ONLY",device,revision:data.revision,accessGranted:false,canBook:false,canPay:false,canMessage:false,canDeploy:false,stagingApproved:false});
   devices.set(device,result);
   if(assessLaunchGaps().openCount!==7){devices.clear();return deny("launch_gate_changed")}
   return result;
  }catch{return deny("read_unavailable")}
 }
 return Object.freeze({refresh,snapshot:device=>devices.get(device)||deny("unavailable"),offline(){online=false;return clear("offline")},reconnect(){online=true;return clear("revalidate_required")},switchAccount(uid=null){owner=uid;highest=0;return clear("account_changed")},stop(){active=false;owner=null;return clear("stopped")},canBook:false,canPay:false,canMessage:false,canDeploy:false,stagingApproved:false});
}
module.exports=Object.freeze({createMultiDeviceGate});
