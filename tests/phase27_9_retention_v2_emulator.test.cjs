"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path"),fs=require("node:fs");
if(process.env.GCLOUD_PROJECT!=="demo-boustio-phase279"||process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080"||process.env.BOUSTIO_CHAT_ENABLED==="true")throw Error("Demo emulator required");
const {createRequire}=require("node:module"),fromFunctions=createRequire(path.resolve(__dirname,"../functions/package.json"));
const {initializeApp,deleteApp}=fromFunctions("firebase-admin/app"),{getFirestore,Timestamp}=fromFunctions("firebase-admin/firestore");
const app=initializeApp({projectId:"demo-boustio-phase279"},"phase279"),db=getFirestore(app);
const {makeRetentionV2,writeStagingV2}=require("../functions/chatRetentionV2");
const args={db,projectId:"demo-boustio-phase279",businessId:"salonTest",identityId:"uidTest",kind:"identity",nowMs:1700000000000};
test.after(async()=>deleteApp(app));
test("Timestamp expiry uses native Firestore Timestamp",()=>{const r=makeRetentionV2(args);assert.ok(r.expiresAt instanceof Timestamp);assert.ok(r.createdAt instanceof Timestamp);});
test("Schema v2 keeps numeric expiry for backwards inspection",()=>{const r=makeRetentionV2(args);assert.equal(r.schemaVersion,2);assert.equal(r.expiresAt.toMillis(),r.expiresAtMs);});
test("Window-aligned expiry is later than creation",()=>{const r=makeRetentionV2(args);assert.ok(r.expiresAt.toMillis()>r.createdAt.toMillis());});
test("All allowed budget kinds supported",()=>{for(const kind of ["identity","business","signal"])assert.equal(makeRetentionV2({...args,kind}).kind,kind);});
test("Unknown budget kind rejected",()=>assert.throws(()=>makeRetentionV2({...args,kind:"booking"})));
test("Malformed identity rejected",()=>assert.throws(()=>makeRetentionV2({...args,identityId:"../../bookings"})));
test("Invalid time rejected",()=>assert.throws(()=>makeRetentionV2({...args,nowMs:-1})));
test("Real emulator writes nested v2 timestamp document",async()=>{
 const r=await writeStagingV2(args);assert.equal(r.created,true);
 const docs=await db.collectionGroup("identity").get();
 const match=docs.docs.find(x=>x.ref.path.startsWith("chatAbuseBudgetsV2/"));
 assert.ok(match);assert.ok(match.get("expiresAt") instanceof Timestamp);
});
test("Duplicate write rejected without changing count",async()=>{
 await assert.rejects(writeStagingV2(args));
 const docs=await db.collectionGroup("identity").get();
 const match=docs.docs.find(x=>x.ref.path.startsWith("chatAbuseBudgetsV2/"));
 assert.equal(match.get("count"),1);
});
test("Wrong project rejected before any write",async()=>assert.rejects(writeStagingV2({...args,projectId:"real-production"})));
test("Production legacy budget collection remains untouched",async()=>assert.equal((await db.collection("chatAbuseBudgets").get()).empty,true));
test("Booking sentinel preserved in emulator",async()=>{
 const ref=db.collection("bookings").doc("originalAppointment");await ref.set({service:"Haircut"});
 await writeStagingV2({...args,identityId:"differentUid"});
 assert.equal((await ref.get()).get("service"),"Haircut");
});
test("Live handlers never import v2 module",()=>{const s=fs.readFileSync(path.resolve(__dirname,"../functions/index.js"),"utf8");assert.equal(s.includes('require("./chatRetentionV2")'),false);});
