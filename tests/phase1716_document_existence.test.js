"use strict";
const assert=require("node:assert/strict");
const {createRealFirebaseReadOnlyProbe}=require("../functions/phase173RealFirebaseReadOnlyProbe");
async function main(){
 for(let missing=0;missing<3;missing++){
  let reads=0,writes=0;
  const db={
   collection(name){return {doc(id){return {path:name+"/"+id,collection(child){return {doc(key){return {path:name+"/"+id+"/"+child+"/"+key};}}}};}};},
   async runTransaction(fn,options){
    assert.deepEqual(options,{readOnly:true,maxAttempts:1});
    return fn({async get(){const index=reads++;return {exists:index!==missing};},
      set(){writes++;throw Error("WRITE_FORBIDDEN");},create(){writes++;throw Error("WRITE_FORBIDDEN");},
      update(){writes++;throw Error("WRITE_FORBIDDEN");},delete(){writes++;throw Error("WRITE_FORBIDDEN");}});
   }
  };
  const probe=createRealFirebaseReadOnlyProbe({db,projectId:"test-project",allowedProjectId:"test-project",enabled:true});
  const result=await probe.verify("private-owner-id");
  assert.equal(result.status,"REAL_FIREBASE_DOCUMENTS_MISSING");
  assert.equal(result.documentsPresent,2);
  const labels=["publicBusiness","staff","bookings"];
  for(let i=0;i<3;i++)assert.equal(result.documentStatus[labels[i]],i===missing?"MISSING":"PRESENT");
  assert.equal(writes,0);assert.equal(reads,3);
  assert.equal(result.acceptingBookings,false);
  assert.equal(result.reservationCreated,false);
  assert.ok(!JSON.stringify(result).includes("private-owner-id"));
 }
 const invalid=await createRealFirebaseReadOnlyProbe({enabled:false}).verify("private-owner-id");
 assert.equal(invalid.documentStatus,undefined);
 console.log("PASS Phase 17.16 fixed-label document existence diagnostics and zero-write safeguards");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
