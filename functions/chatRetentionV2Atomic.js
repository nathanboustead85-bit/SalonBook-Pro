"use strict";
// Phase 27.10: emulator-only atomic counter v2; not wired to live chat.
const {createHash}=require("node:crypto");
const {Timestamp}=require("firebase-admin/firestore");
const {WINDOW_MS,LIMITS}=require("./chatAbuseBudget");
const ID=/^[A-Za-z0-9_-]{1,128}$/;
const hash=s=>createHash("sha256").update(s).digest("hex");
function assertArgs({projectId,businessId,uid,nowMs}={}){
 if(typeof projectId!=="string"||!/^demo-boustio-[a-z0-9-]+$/.test(projectId))throw Error("Demo project required");
 if(!ID.test(businessId||"")||!ID.test(uid||"")||!Number.isSafeInteger(nowMs)||nowMs<0)throw Error("Invalid budget input");
}
async function consumeV2Staging(db,{projectId,businessId,uid,nowMs}={}){
 assertArgs({projectId,businessId,uid,nowMs});
 const window=Math.floor(nowMs/WINDOW_MS);
 const bucket=db.collection("chatAbuseBudgetsV2").doc(hash(businessId+":"+window));
 // Distinct collection IDs to avoid broad TTL policies affecting unrelated records.
 const refs=[bucket.collection("boustioV2IdentityCounters").doc(hash(uid)),bucket.collection("boustioV2BusinessCounters").doc("all")];
 const limits=[LIMITS.identity,LIMITS.business];
 return db.runTransaction(async tx=>{
  const snaps=await Promise.all(refs.map(ref=>tx.get(ref)));
  const counts=snaps.map(s=>s.exists?s.get("count"):0);
  if(counts.some(c=>!Number.isSafeInteger(c)||c<0))throw Error("Corrupt counter");
  if(counts.some((c,i)=>c>=limits[i]))return Object.freeze({allowed:false,reason:"rate-limited"});
  const createdAt=Timestamp.fromMillis(nowMs);
  const expiresAt=Timestamp.fromMillis((window+2)*WINDOW_MS);
  refs.forEach((ref,i)=>tx.set(ref,{schemaVersion:2,count:counts[i]+1,window,createdAt:snaps[i].exists?snaps[i].get("createdAt"):createdAt,expiresAt,expiresAtMs:expiresAt.toMillis()}));
  return Object.freeze({allowed:true});
 });
}
module.exports={consumeV2Staging,assertArgs};
