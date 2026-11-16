"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createRealFirebaseReadOnlyProbe}=require("../functions/phase173RealFirebaseReadOnlyProbe");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
async function main(){
 let reads=0,writes=0,transactions=0;
 const paths=[];
 const db={collection(name){return {doc(id){const root=name+"/"+id;return {path:root,collection(child){return {doc(key){return {path:root+"/"+child+"/"+key};}}}};}};},
  async runTransaction(fn,options){
   transactions++;assert.deepEqual(options,{readOnly:true,maxAttempts:1});
   return fn({async get(ref){reads++;paths.push(ref.path);return {exists:true};},
    set(){writes++;throw Error("write forbidden");},create(){writes++;throw Error("write forbidden");},
    update(){writes++;throw Error("write forbidden");},delete(){writes++;throw Error("write forbidden");}});
  }};
 const make=(options={})=>createRealFirebaseReadOnlyProbe({db,projectId:"test-project",allowedProjectId:"test-project",...options});
 const disabled=await make().verify("salonA");
 assert.equal(disabled.status,"REAL_FIREBASE_PROBE_DISABLED");
 assert.equal(reads,0);
 assert.equal((await make({enabled:true,allowedProjectId:"other"}).verify("salonA")).status,"REAL_FIREBASE_PROBE_DISABLED");
 assert.equal(reads,0);
 const probe=make({enabled:true});
 assert.equal((await probe.verify("../unsafe")).status,"REAL_FIREBASE_PROBE_INVALID");
 assert.equal(reads,0);
 const result=await probe.verify("salonA");
 assert.equal(result.status,"REAL_FIREBASE_METADATA_READ_VERIFIED");
 assert.equal(result.documentsPresent,3);
 assert.equal(result.acceptingBookings,false);
 assert.equal(result.reservationCreated,false);
 assert.equal(result.productionReady,false);
 assert.equal(reads,3);assert.equal(writes,0);assert.equal(transactions,1);
 assert.deepEqual(paths,["publicBusinesses/salonA","users/salonA/liveData/staff","users/salonA/liveData/bookings"]);
 const missing=await make({enabled:true,db:{...db,runTransaction:async fn=>fn({get:async()=>({exists:false})})}}).verify("salonA");
 assert.equal(missing.status,"REAL_FIREBASE_DOCUMENTS_MISSING");
 const offline=await make({enabled:true,db:{...db,runTransaction:async()=>{throw Error("offline");}}}).verify("salonA");
 assert.equal(offline.status,"REAL_FIREBASE_PROBE_REVIEW_REQUIRED");
 assert.equal(offline.failureCode,"UNKNOWN");
 for(const [code,expected] of [[7,"PERMISSION_DENIED"],[16,"UNAUTHENTICATED"],[14,"SERVICE_UNAVAILABLE"],[4,"DEADLINE_EXCEEDED"],[9,"FAILED_PRECONDITION"]]){
  const failure=await make({enabled:true,db:{...db,runTransaction:async()=>{throw Object.assign(new Error("private details"),{code});}}}).verify("salonA");
  assert.equal(failure.failureCode,expected);
  assert.equal(failure.acceptingBookings,false);
  assert.ok(!JSON.stringify(failure).includes("private details"));
 }
 for(const [error,expected] of [
  [{code:"INVALID_ARGUMENT"},"INVALID_ARGUMENT"],
  [{code:12},"UNIMPLEMENTED"],
  [{code:8},"RESOURCE_EXHAUSTED"],
  [{cause:{code:7},message:"private details"},"PERMISSION_DENIED"],
  [{message:"iam.serviceAccounts.getAccessToken rejected: private token"},"SERVICE_ACCOUNT_IMPERSONATION"],
  [{message:"invalid_grant private token"},"FEDERATED_CREDENTIAL_REJECTED"],
  [{message:"Could not load the default credentials private path"},"CREDENTIALS_UNAVAILABLE"],
  [{message:"403 Forbidden private identity"},"PERMISSION_DENIED"],
  [{message:"unrecognized private customer content"},"UNKNOWN"]
 ]){
  const failure=await make({enabled:true,db:{...db,runTransaction:async()=>{throw error;}}}).verify("salonA");
  assert.equal(failure.failureCode,expected);
  assert.equal(failure.acceptingBookings,false);
  assert.equal(failure.reservationCreated,false);
  assert.ok(!JSON.stringify(failure).includes("private"));
 }
 assert.deepEqual(await probe.reserve(),DISABLED);
 const entry=fs.readFileSync(path.join(__dirname,"../functions/index.js"),"utf8");
 const source=fs.readFileSync(path.join(__dirname,"../functions/phase173RealFirebaseReadOnlyProbe.js"),"utf8");
 assert.ok(!entry.includes("phase173RealFirebaseReadOnlyProbe"));
 assert.ok(!source.includes("onCall(")&&!source.includes("onRequest("));
 assert.ok(!JSON.stringify(result).includes("salonA"));
 console.log("PASS Phase 17.3 opt-in read-only Firebase metadata probe and no-write safeguards");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
