"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path");
if(process.env.GCLOUD_PROJECT!=="demo-boustio-phase276"||process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080"||process.env.BOUSTIO_CHAT_ENABLED==="true")throw Error("Isolated emulator required");
const {createRequire}=require("node:module"),fromFunctions=createRequire(path.resolve(__dirname,"../functions/package.json"));
const {initializeApp,deleteApp}=fromFunctions("firebase-admin/app"),{getFirestore}=fromFunctions("firebase-admin/firestore");
const app=initializeApp({projectId:"demo-boustio-phase276"},"phase276"),db=getFirestore(app);
const {deleteExpiredStagingRecord,validateDeletionRequest}=require("../functions/chatStagingRetentionDeletion");
const projectId="demo-boustio-phase276",nowMs=1000000;
const opts=(collection,docId)=>({db,collection,docId,nowMs,projectId});
test.after(async()=>{await deleteApp(app);});
test("Expired aggregate deleted in real Firestore emulator",async()=>{
 const ref=db.collection("chatMonitoringAggregates").doc("expiredAggregate");
 await ref.set({expiresAtMs:nowMs-1,count:1});
 const r=await deleteExpiredStagingRecord(opts("chatMonitoringAggregates","expiredAggregate"));
 assert.equal(r.deleted,true);assert.equal((await ref.get()).exists,false);
});
test("Unexpired aggregate remains unchanged",async()=>{
 const ref=db.collection("chatMonitoringAggregates").doc("freshAggregate");
 await ref.set({expiresAtMs:nowMs+1000,count:2});
 const r=await deleteExpiredStagingRecord(opts("chatMonitoringAggregates","freshAggregate"));
 assert.equal(r.deleted,false);assert.equal((await ref.get()).get("count"),2);
});
test("Expired budget deleted in real emulator",async()=>{
 const ref=db.collection("chatAbuseBudgets").doc("expiredBudget");
 await ref.set({expiresAtMs:nowMs-1});
 assert.equal((await deleteExpiredStagingRecord(opts("chatAbuseBudgets","expiredBudget"))).deleted,true);
});
test("Missing record is a safe no-op",async()=>{assert.equal((await deleteExpiredStagingRecord(opts("chatAbuseBudgets","notPresent"))).reason,"missing");});
test("Conversation collection cannot be deleted",async()=>{await assert.rejects(deleteExpiredStagingRecord(opts("businesses","salonA")));});
test("Appointments collection cannot be deleted",async()=>{await assert.rejects(deleteExpiredStagingRecord(opts("bookings","originalAppointment")));});
test("Non-demo project cannot be used",async()=>{await assert.rejects(deleteExpiredStagingRecord({...opts("chatAbuseBudgets","test"),projectId:"production"}));});
test("Missing expiry fails closed and preserves record",async()=>{
 const ref=db.collection("chatAbuseBudgets").doc("missingExpiry");await ref.set({count:1});
 await assert.rejects(deleteExpiredStagingRecord(opts("chatAbuseBudgets","missingExpiry")));
 assert.equal((await ref.get()).exists,true);
});
test("Malformed expiry fails closed and preserves record",async()=>{
 const ref=db.collection("chatAbuseBudgets").doc("badExpiry");await ref.set({expiresAtMs:"yesterday"});
 await assert.rejects(deleteExpiredStagingRecord(opts("chatAbuseBudgets","badExpiry")));
 assert.equal((await ref.get()).exists,true);
});
test("Boundary expiry is eligible",()=>{assert.equal(validateDeletionRequest({collection:"chatAbuseBudgets",docId:"b",nowMs,expiresAtMs:nowMs,projectId}).eligible,true);});
test("Reject nested document IDs",()=>{assert.throws(()=>validateDeletionRequest({collection:"chatAbuseBudgets",docId:"a/b",nowMs,expiresAtMs:0,projectId}));});
test("Never alters a protected booking sentinel",async()=>{
 const ref=db.collection("bookings").doc("originalAppointment");await ref.set({service:"Haircut",time:"20 Nov 2026"});
 const budget=db.collection("chatTrustedCorrelationBudgets").doc("expiredTrusted");await budget.set({expiresAtMs:nowMs-1});
 await deleteExpiredStagingRecord(opts("chatTrustedCorrelationBudgets","expiredTrusted"));
 assert.equal((await ref.get()).get("service"),"Haircut");
});
