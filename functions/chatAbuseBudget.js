"use strict";
// Phase 26.10: opt-in, emulator-testable server-side abuse budget.
// Not wired into live callable handlers. Do not enable chat until integration
// and App Check enforcement are verified with authenticated staging clients.
const {createHash}=require("node:crypto");
const WINDOW_MS=60*60*1000;
const LIMITS=Object.freeze({identity:20,business:300,signal:40});
function keyHash(value){return createHash("sha256").update(value).digest("hex");}
function validate({businessId,uid,signal,now}){
 if(typeof businessId!=="string"||!/^[a-zA-Z0-9_-]{1,128}$/.test(businessId))throw Error("Invalid business");
 if(typeof uid!=="string"||!/^[a-zA-Z0-9_-]{1,128}$/.test(uid))throw Error("Invalid identity");
 if(signal!==undefined&&(typeof signal!=="string"||signal.length<8||signal.length>256))throw Error("Invalid risk signal");
 if(!Number.isSafeInteger(now)||now<0)throw Error("Invalid time");
}
// Privacy: callers must provide an already-derived, non-reversible risk signal;
// never store a raw IP address, user agent or device fingerprint here.
async function consumeBudget(db,{businessId,uid,signal,now=Date.now()}){
 validate({businessId,uid,signal,now});
 const window=Math.floor(now/WINDOW_MS);
 const bucket=db.collection("chatAbuseBudgets").doc(keyHash(businessId+":"+window));
 const checks=[["identity",keyHash(uid),LIMITS.identity],["business","all",LIMITS.business]];
 if(signal)checks.push(["signal",keyHash(signal),LIMITS.signal]);
 return db.runTransaction(async tx=>{
  const refs=checks.map(([kind,id])=>bucket.collection(kind).doc(id));
  const snaps=await Promise.all(refs.map(ref=>tx.get(ref)));
  const blocked=snaps.some((snap,i)=>(snap.exists?(snap.get("count")||0):0)>=checks[i][2]);
  if(blocked)return {allowed:false,reason:"rate-limited",retryAfterMs:(window+1)*WINDOW_MS-now};
  refs.forEach((ref,i)=>tx.set(ref,{count:(snaps[i].exists?(snaps[i].get("count")||0):0)+1,window,expiresAtMs:(window+2)*WINDOW_MS}));
  return {allowed:true,retryAfterMs:0};
 });
}
module.exports={consumeBudget,WINDOW_MS,LIMITS};
