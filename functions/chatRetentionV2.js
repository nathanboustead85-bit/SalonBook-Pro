"use strict";
// Phase 27.9 isolated v2 retention writer. Never imported by live handlers.
const {Timestamp}=require("firebase-admin/firestore");
const {POLICY}=require("./chatRetentionReliability");
const {createHash}=require("node:crypto");
const ID=/^[A-Za-z0-9_-]{1,128}$/;
const HOUR=3600000;
function makeRetentionV2({businessId,identityId,kind,nowMs}={}){
 if(!ID.test(businessId||"")||!ID.test(identityId||""))throw Error("Invalid identity");
 if(!["identity","business","signal"].includes(kind))throw Error("Invalid budget kind");
 if(!Number.isSafeInteger(nowMs)||nowMs<0)throw Error("Invalid timestamp");
 const window=Math.floor(nowMs/HOUR);
 const createdAt=Timestamp.fromMillis(nowMs);
 const expiresAt=Timestamp.fromMillis((window+2)*HOUR);
 return Object.freeze({schemaVersion:2,kind,window,count:1,createdAt,expiresAt,expiresAtMs:expiresAt.toMillis()});
}
async function writeStagingV2({db,projectId,businessId,identityId,kind,nowMs}={}){
 if(typeof projectId!=="string"||!projectId.startsWith("demo-boustio-"))throw Error("Demo project only");
 const data=makeRetentionV2({businessId,identityId,kind,nowMs});
 const hash=s=>createHash("sha256").update(s).digest("hex");
 const bucket=db.collection("chatAbuseBudgetsV2").doc(hash(businessId+":"+data.window));
 const ref=bucket.collection(kind).doc(hash(identityId));
 await db.runTransaction(async tx=>{
  const snap=await tx.get(ref);
  if(snap.exists)throw Error("Existing record must not be overwritten");
  tx.create(ref,data);
 });
 return Object.freeze({collection:"chatAbuseBudgetsV2",created:true,expiryMs:data.expiresAtMs});
}
module.exports={makeRetentionV2,writeStagingV2,POLICY};
