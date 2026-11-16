"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createPersistentRecoveryPreparation,MAX_AGE_MS}=require("../functions/phase154PersistentRecoveryPreparation");
const {prepareBookingStoragePlan}=require("../functions/phase151BookingInfrastructurePreparation");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const input={ownerId:"owner1",key:"request_12345",secret:"phase154-secret-at-least-32-bytes-long",
 intent:{serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"09:00"}};
const plan=prepareBookingStoragePlan(input),now=1800000000000;
function fixture({exists=true,fingerprint=plan.fingerprint,state="COMMITTED_SIMULATION",
 createdAt=now-1000,fail=false}={}){
 const trace=[];
 const db={
  collection(name){return {doc(id){return ref(name+"/"+id);}};},
  async runTransaction(fn,options){
   trace.push(["transaction",options]);
   if(fail)throw Error("offline");
   return fn({
    async get(document){
     trace.push(["get",document.path]);
     return {exists,get(field){return {fingerprint,state,createdAt}[field];}};
    },
    set(){throw Error("writes forbidden");},
    create(){throw Error("writes forbidden");},
    update(){throw Error("writes forbidden");},
    delete(){throw Error("writes forbidden");}
   });
  }
 };
 function ref(p){return {path:p,collection(name){return {doc(id){return ref(p+"/"+name+"/"+id);}}}};}
 return {db,trace};
}
async function main(){
 const f=fixture(),api=createPersistentRecoveryPreparation(f.db,{clock:()=>now});
 const result=await api.inspect(input);
 assert.equal(result.status,"RECOVERY_SIMULATED_OUTCOME_FOUND");
 assert.equal(result.acceptingBookings,false);
 assert.equal(result.reservationCreated,false);
 assert.deepEqual(f.trace[0][1],{maxAttempts:3,readOnly:true});
 assert.deepEqual(f.trace[1],["get",plan.recoveryDocumentPath]);
 assert.deepEqual(await api.reserve(input),DISABLED);
 for(const [opts,expected] of [
  [{exists:false},"RECOVERY_NOT_FOUND_RETRY_NOT_AUTHORIZED"],
  [{fingerprint:"0".repeat(64)},"RECOVERY_KEY_REUSED_OR_CORRUPT"],
  [{fingerprint:"invalid"},"RECOVERY_KEY_REUSED_OR_CORRUPT"],
  [{state:"PENDING"},"RECOVERY_OUTCOME_UNCERTAIN"],
  [{state:"COMMITTED"},"RECOVERY_OUTCOME_UNCERTAIN"],
  [{createdAt:now+1},"RECOVERY_OUTCOME_UNCERTAIN"],
  [{createdAt:now-MAX_AGE_MS-1},"RECOVERY_OUTCOME_UNCERTAIN"],
  [{fail:true},"RECOVERY_OUTCOME_UNCERTAIN"]
 ]){
  const x=fixture(opts);
  assert.equal((await createPersistentRecoveryPreparation(x.db,{clock:()=>now}).inspect(input)).status,expected);
 }
 assert.equal((await api.inspect({...input,key:"short"})).status,"RECOVERY_REQUEST_INVALID");
 assert.throws(()=>createPersistentRecoveryPreparation({}),TypeError);
 const src=fs.readFileSync(path.resolve(__dirname,"../functions/phase154PersistentRecoveryPreparation.js"),"utf8");
 assert.ok(!/\btx\.(?:set|create|update|delete)\s*\(/.test(src));
 assert.ok(!src.includes("firebase-admin"));
 const entry=fs.readFileSync(path.resolve(__dirname,"../functions/index.js"),"utf8");
 assert.ok(!entry.includes("phase154PersistentRecoveryPreparation"));
 console.log("PASS Phase 15.4 read-only durable recovery, fingerprint, expiry, offline and disabled bookings");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
