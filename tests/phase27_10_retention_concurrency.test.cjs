"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path"),fs=require("node:fs");
if(process.env.GCLOUD_PROJECT!=="demo-boustio-phase2710"||process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080"||process.env.BOUSTIO_CHAT_ENABLED==="true")throw Error("Isolated demo emulator required");
const {createRequire}=require("node:module"),fromFunctions=createRequire(path.resolve(__dirname,"../functions/package.json"));
const {initializeApp,deleteApp}=fromFunctions("firebase-admin/app"),{getFirestore,Timestamp}=fromFunctions("firebase-admin/firestore");
const app=initializeApp({projectId:"demo-boustio-phase2710"},"phase2710"),db=getFirestore(app);
const {consumeV2Staging}=require("../functions/chatRetentionV2Atomic");
const {LIMITS}=require("../functions/chatAbuseBudget");
const args={projectId:"demo-boustio-phase2710",businessId:"salon2710",uid:"userA",nowMs:1700000000000};
test.after(async()=>deleteApp(app));
test("First transaction succeeds",async()=>assert.equal((await consumeV2Staging(db,args)).allowed,true));
test("Concurrent transactions never lose increments",async()=>{
 const results=await Promise.all(Array.from({length:8},()=>consumeV2Staging(db,{...args,uid:"concurrentA",businessId:"concurrentSalon"})));
 assert.equal(results.filter(r=>r.allowed).length,8);
 const docs=await db.collectionGroup("boustioV2IdentityCounters").get();
 const found=docs.docs.find(d=>d.get("count")===8);assert.ok(found);
});
test("Identity quota caps simultaneous calls",async()=>{
 const base={...args,uid:"quotaUid",businessId:"quotaSalon"};
 const results=await Promise.all(Array.from({length:LIMITS.identity+4},()=>consumeV2Staging(db,base)));
 assert.equal(results.filter(r=>r.allowed).length,LIMITS.identity);
 assert.equal(results.filter(r=>!r.allowed).length,4);
});
test("Other customer retains independent identity quota",async()=>{
 assert.equal((await consumeV2Staging(db,{...args,uid:"userB"})).allowed,true);
});
test("Firestore Timestamp fields are persisted",async()=>{
 const docs=await db.collectionGroup("boustioV2IdentityCounters").get();
 assert.ok(docs.docs.some(d=>d.get("expiresAt") instanceof Timestamp&&d.get("createdAt") instanceof Timestamp));
});
test("Numeric legacy expiry retained for compatibility inspection",async()=>{
 const docs=await db.collectionGroup("boustioV2IdentityCounters").get();
 assert.ok(docs.docs.every(d=>d.get("expiresAtMs")===d.get("expiresAt").toMillis()));
});
test("Existing legacy collection is never written",async()=>assert.equal((await db.collection("chatAbuseBudgets").get()).empty,true));
test("Existing v2 prototype groups are not overwritten",async()=>assert.equal((await db.collectionGroup("identity").get()).empty,true));
test("Production project is rejected",async()=>assert.rejects(consumeV2Staging(db,{...args,projectId:"boustio-production"})));
test("Invalid UID rejected",async()=>assert.rejects(consumeV2Staging(db,{...args,uid:"../../bookings"})));
test("Negative clock rejected",async()=>assert.rejects(consumeV2Staging(db,{...args,nowMs:-1})));
test("Corrupt counter fails closed",async()=>{
 const {createHash}=require("node:crypto"),h=s=>createHash("sha256").update(s).digest("hex");
 const window=Math.floor(args.nowMs/3600000),bucket=db.collection("chatAbuseBudgetsV2").doc(h("corruptSalon:"+window));
 await bucket.collection("boustioV2IdentityCounters").doc(h("corruptUser")).set({count:"oops"});
 await assert.rejects(consumeV2Staging(db,{...args,businessId:"corruptSalon",uid:"corruptUser"}));
});
test("Booking sentinel is preserved",async()=>{
 const ref=db.collection("bookings").doc("originalAppointment");await ref.set({service:"Haircut"});
 await consumeV2Staging(db,{...args,uid:"sentinelUser"});
 assert.equal((await ref.get()).get("service"),"Haircut");
});
test("No live callable imports v2 atomic module",()=>{const src=fs.readFileSync(path.resolve(__dirname,"../functions/index.js"),"utf8");assert.equal(src.includes('require("./chatRetentionV2Atomic")'),false);});
