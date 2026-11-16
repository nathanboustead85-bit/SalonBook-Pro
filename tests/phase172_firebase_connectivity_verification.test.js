"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createFirebaseConnectivityVerification}=require("../functions/phase172FirebaseConnectivityVerification");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const secret="phase172-server-secret-more-than-32-characters";
const input={ownerId:"salonA",key:"request_12345",intent:{serviceId:"cut",staffId:"barber",date:"2026-11-20",time:"10:00"}};
async function main(){
 let reads=0,writes=0,transactions=0;
 const paths=[];
 const db={
  collection(name){return {doc(id){const root=name+"/"+id;return {
   path:root,collection(child){return {doc(key){return {path:root+"/"+child+"/"+key};}}}
  };}};},
  async runTransaction(fn,options){
   transactions++;assert.equal(options.readOnly,true);
   return fn({
    async get(ref){reads++;paths.push(ref.path);return {exists:false};},
    set(){writes++;throw Error("writes forbidden");},
    create(){writes++;throw Error("writes forbidden");},
    update(){writes++;throw Error("writes forbidden");},
    delete(){writes++;throw Error("writes forbidden");}
   });
  }
 };
 const audit=createFirebaseConnectivityVerification(db,{secret,clock:()=>1000000});
 const result=await audit.verify(input);
 assert.equal(result.status,"FIREBASE_VERIFICATION_REVIEW_REQUIRED");
 assert.equal(result.snapshotVerified,false);
 assert.equal(result.acceptingBookings,false);
 assert.equal(result.reservationCreated,false);
 assert.equal(result.productionReady,false);
 assert.equal(reads,3);
 assert.equal(transactions,1);
 assert.equal(writes,0);
 assert.deepEqual(paths,["publicBusinesses/salonA","users/salonA/liveData/staff","users/salonA/liveData/bookings"]);
 for(const invalid of [{...input,ownerId:"../bad"},{...input,key:"bad"},{}]){
  const response=await audit.verify(invalid);
  assert.ok(response.status.endsWith("INVALID")||response.status.endsWith("REVIEW_REQUIRED"));
  assert.equal(response.acceptingBookings,false);
 }
 assert.equal(transactions,1,"invalid input must never query Firebase");
 const offline=createFirebaseConnectivityVerification({...db,runTransaction:async()=>{throw Error("offline");}},{secret});
 assert.equal((await offline.verify(input)).status,"FIREBASE_VERIFICATION_REVIEW_REQUIRED");
 assert.deepEqual(await audit.reserve(input),DISABLED);
 const entry=fs.readFileSync(path.join(__dirname,"../functions/index.js"),"utf8");
 const source=fs.readFileSync(path.join(__dirname,"../functions/phase172FirebaseConnectivityVerification.js"),"utf8");
 assert.ok(!entry.includes("phase172FirebaseConnectivityVerification"),"no deployed booking endpoint");
 assert.ok(!source.includes("onCall(")&&!source.includes("onRequest("));
 assert.ok(!JSON.stringify(result).includes("salonA"));
 assert.ok(!JSON.stringify(result).includes("request_12345"));
 console.log("PASS Phase 17.2 read-only Firebase connectivity adapter, fail-closed responses, disabled bookings");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
