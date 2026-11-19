"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path");
if(process.env.GCLOUD_PROJECT!=="demo-boustio-phase2611"||process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080"||process.env.BOUSTIO_CHAT_ENABLED!=="false")throw Error("Isolated emulator and disabled chat required");
const {createRequire}=require("node:module");
const fromFunctions=createRequire(path.resolve(__dirname,"../functions/package.json"));
const {initializeApp,deleteApp}=fromFunctions("firebase-admin/app");
const {getFirestore}=fromFunctions("firebase-admin/firestore");
const {consumeBudget,LIMITS,WINDOW_MS}=require("../functions/chatAbuseBudget");
const app=initializeApp({projectId:"demo-boustio-phase2611"},"phase2611");
const db=getFirestore(app);
const now=WINDOW_MS*100;
const request=(businessId,uid,signal,time=now)=>consumeBudget(db,{businessId,uid,signal,now:time});
test.before(async()=>{await db.recursiveDelete(db.collection("chatAbuseBudgets"));});
test.after(async()=>{await db.recursiveDelete(db.collection("chatAbuseBudgets"));await deleteApp(app);});
test("Same identity quota holds under concurrent transaction contention",async()=>{
 const attempts=Array.from({length:LIMITS.identity+8},()=>request("salon-a","customer-1"));
 const results=await Promise.allSettled(attempts);
 const accepted=results.filter(r=>r.status==="fulfilled"&&r.value.allowed).length;
 const denied=results.filter(r=>r.status==="fulfilled"&&!r.value.allowed).length;
 assert.equal(accepted,LIMITS.identity);
 assert.equal(denied,8);
});
test("Rotating identities share one trusted risk-signal budget",async()=>{
 let allowed=0;
 for(let i=0;i<LIMITS.signal+5;i++){
  const result=await request("salon-b","rotating-"+i,"trusted-risk-signal-001");
  if(result.allowed)allowed++;
 }
 assert.equal(allowed,LIMITS.signal);
 assert.equal((await request("salon-b","new-rotated","trusted-risk-signal-001")).allowed,false);
 assert.equal((await request("salon-b","fresh-identity","trusted-risk-signal-002")).allowed,true);
});
test("Business-wide quota caps unique identities even without a signal",async()=>{
 let allowed=0;
 for(let i=0;i<LIMITS.business+3;i++){
  const result=await request("salon-c","unique-"+i);
  if(result.allowed)allowed++;
 }
 assert.equal(allowed,LIMITS.business);
 assert.equal((await request("salon-c","another-new-account")).allowed,false);
});
test("Business isolation and hour boundary reset",async()=>{
 assert.equal((await request("salon-c","independent-business","trusted-risk-signal-001")).allowed,false);
 assert.equal((await request("salon-d","independent-business","trusted-risk-signal-001")).allowed,true);
 assert.equal((await request("salon-c","another-new-account",undefined,now+WINDOW_MS)).allowed,true);
});
test("Rejected attempts do not increment other counters",async()=>{
 const denied=await request("salon-a","customer-1","trusted-risk-signal-unused");
 assert.equal(denied.allowed,false);
 const accepted=await request("salon-a","customer-2","trusted-risk-signal-unused");
 assert.equal(accepted.allowed,true);
});
test("Rate limit includes positive retry delay",async()=>{
 const result=await request("salon-a","customer-1");
 assert.equal(result.allowed,false);
 assert.ok(result.retryAfterMs>0&&result.retryAfterMs<=WINDOW_MS);
});
