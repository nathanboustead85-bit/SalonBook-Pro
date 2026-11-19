"use strict";
const {createHash}=require("node:crypto");
const {LIMITS,WINDOW_MS}=require("./chatAbuseBudget");
const hash=s=>createHash("sha256").update(s).digest("hex");
// Reads all budget documents before any transaction writes. Shared with message writes.
async function consumeBudgetWithinTransaction(tx,db,{businessId,uid,now}){
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(businessId)||!/^[A-Za-z0-9_-]{1,128}$/.test(uid)||!Number.isSafeInteger(now))throw Error("Invalid budget identity");
 const window=Math.floor(now/WINDOW_MS);
 const bucket=db.collection("chatAbuseBudgets").doc(hash(businessId+":"+window));
 const checks=[["identity",hash(uid),LIMITS.identity],["business","all",LIMITS.business]];
 const refs=checks.map(([kind,id])=>bucket.collection(kind).doc(id));
 const snaps=await Promise.all(refs.map(ref=>tx.get(ref)));
 if(snaps.some((snap,i)=>(snap.exists?(snap.get("count")||0):0)>=checks[i][2]))
   return {allowed:false};
 refs.forEach((ref,i)=>tx.set(ref,{count:(snaps[i].exists?(snaps[i].get("count")||0):0)+1,window,expiresAtMs:(window+2)*WINDOW_MS}));
 return {allowed:true};
}
module.exports={consumeBudgetWithinTransaction};
