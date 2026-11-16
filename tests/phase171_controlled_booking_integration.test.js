"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createControlledBookingIntegration}=require("../functions/phase171ControlledBookingIntegration");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const secret="phase171-server-secret-more-than-32-characters";
const input={ownerId:"salonA",key:"request_12345",intent:{serviceId:"cut",staffId:"barber",date:"2026-11-20",time:"10:00"}};
async function main(){
 let reads=0,transactions=0,writes=0;
 const paths=[];
 const db={
  collection(name){return {doc(id){
   const root=name+"/"+id;
   return {path:root,collection(child){return {doc(key){return {path:root+"/"+child+"/"+key};}}}};
  }};},
  async runTransaction(fn,options){
   transactions++;
   assert.equal(options.readOnly,true,"must explicitly request a read-only transaction");
   return fn({
    async get(ref){reads++;paths.push(ref.path);return {exists:false};},
    set(){writes++;throw Error("write forbidden");},
    update(){writes++;throw Error("write forbidden");},
    delete(){writes++;throw Error("write forbidden");},
    create(){writes++;throw Error("write forbidden");}
   });
  }
 };
 const audit=createControlledBookingIntegration(db,{secret,clock:()=>1000000});
 const result=await audit.inspect(input);
 assert.equal(result.status,"CONTROLLED_INTEGRATION_REVIEW_REQUIRED");
 assert.equal(result.acceptingBookings,false);
 assert.equal(result.reservationCreated,false);
 assert.equal(result.productionReady,false);
 assert.equal(transactions,1);
 assert.equal(reads,3);
 assert.deepEqual(paths,[
  "publicBusinesses/salonA",
  "users/salonA/liveData/staff",
  "users/salonA/liveData/bookings"
 ]);
 assert.equal(writes,0);
 const invalid=await audit.inspect({...input,key:"x"});
 assert.equal(invalid.status,"CONTROLLED_INTEGRATION_INVALID");
 assert.equal(transactions,1,"invalid input must not query Firestore");
 const offline=createControlledBookingIntegration({...db,runTransaction:async()=>{throw Error("offline");}},{secret});
 assert.equal((await offline.inspect(input)).status,"CONTROLLED_INTEGRATION_REVIEW_REQUIRED");
 assert.deepEqual(await audit.reserve(input),DISABLED);
 const entry=fs.readFileSync(path.join(__dirname,"../functions/index.js"),"utf8");
 const source=fs.readFileSync(path.join(__dirname,"../functions/phase171ControlledBookingIntegration.js"),"utf8");
 assert.ok(!entry.includes("phase171ControlledBookingIntegration"),"no public Firebase endpoint");
 assert.ok(!source.includes("onCall(")&&!source.includes("onRequest("));
 assert.ok(!JSON.stringify(result).includes("salonA"));
 assert.ok(!JSON.stringify(result).includes("request_12345"));
 console.log("PASS Phase 17.1 read-only Firestore diagnostic, fail-closed safety, disabled public bookings");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
