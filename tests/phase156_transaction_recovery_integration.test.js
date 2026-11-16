"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createTransactionRecoveryIntegration}=require("../functions/phase156TransactionRecoveryIntegration");
const {prepareBookingStoragePlan}=require("../functions/phase151BookingInfrastructurePreparation");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const input={ownerId:"owner1",key:"request_12345",secret:"phase156-secret-at-least-32-bytes-long",
 intent:{serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"09:00"}};
const plan=prepareBookingStoragePlan(input),now=1800000000000;
function fixture({existing=false,missing=false,published=true,offline=false,
 fingerprint=plan.fingerprint,state="COMMITTED_SIMULATION",createdAt=now-1000}={}){
 const trace=[];
 const ref=p=>({path:p,collection(name){return {doc(id){return ref(p+"/"+name+"/"+id);}}}});
 const db={
  collection(name){return {doc(id){return ref(name+"/"+id);}};},
  async runTransaction(fn,opts){
   trace.push(["transaction",opts]);
   if(offline)throw Error("offline");
   return fn({
    async get(r){
     trace.push(["get",r.path]);
     if(r.path.startsWith("publicBusinesses/"))
      return {exists:true,get:k=>({businessId:"owner1",published,acceptingBookings:false})[k]};
     if(r.path.endsWith("/staff"))return {exists:!missing,get:()=>undefined};
     if(r.path.endsWith("/bookings"))return {exists:true,get:()=>undefined};
     if(r.path.includes("/customerBookingRequests/"))
      return {exists:existing,get:k=>({fingerprint,state,createdAt})[k]};
     throw Error("unexpected path");
    },
    set(){throw Error("write forbidden");},create(){throw Error("write forbidden");},
    update(){throw Error("write forbidden");},delete(){throw Error("write forbidden");}
   });
  }
 };
 return {db,trace};
}
async function main(){
 const clean=fixture(),api=createTransactionRecoveryIntegration(clean.db,{clock:()=>now});
 assert.equal((await api.inspect(input)).status,"INTEGRATION_READ_ONLY_NO_RESERVATION");
 assert.equal(clean.trace.filter(x=>x[0]==="transaction").length,1);
 assert.equal(clean.trace.filter(x=>x[0]==="get").length,4);
 assert.deepEqual(await api.reserve(input),DISABLED);
 const recovered=fixture({existing:true});
 assert.equal((await createTransactionRecoveryIntegration(recovered.db,{clock:()=>now}).inspect(input)).status,
  "INTEGRATION_SIMULATED_OUTCOME_RECOVERED");
 assert.equal(recovered.trace.filter(x=>x[0]==="transaction").length,2);
 assert.equal(recovered.trace.filter(x=>x[0]==="get").length,5);
 assert.deepEqual(recovered.trace.filter(x=>x[0]==="get").at(-1),["get",plan.recoveryDocumentPath]);
 for(const [opts,expected] of [
  [{existing:true,fingerprint:"0".repeat(64)},"INTEGRATION_KEY_REUSED_OR_CORRUPT"],
  [{existing:true,state:"PENDING"},"INTEGRATION_RECOVERY_UNCERTAIN"],
  [{existing:true,createdAt:now+1},"INTEGRATION_RECOVERY_UNCERTAIN"],
  [{offline:true},"INTEGRATION_UNAVAILABLE"],
  [{missing:true},"INTEGRATION_UNAVAILABLE"],
  [{published:false},"INTEGRATION_UNAVAILABLE"]
 ]){
  const x=fixture(opts),out=await createTransactionRecoveryIntegration(x.db,{clock:()=>now}).inspect(input);
  assert.equal(out.status,expected);
  assert.equal(out.acceptingBookings,false);
  assert.equal(out.reservationCreated,false);
 }
 assert.equal((await api.inspect({...input,ownerId:"../invalid"})).status,"INTEGRATION_UNAVAILABLE");
 assert.throws(()=>createTransactionRecoveryIntegration({}),TypeError);
 const source=fs.readFileSync(path.resolve(__dirname,"../functions/phase156TransactionRecoveryIntegration.js"),"utf8");
 const entry=fs.readFileSync(path.resolve(__dirname,"../functions/index.js"),"utf8");
 assert.ok(!entry.includes("phase156TransactionRecoveryIntegration"));
 assert.ok(!/\btx\.(?:set|create|update|delete)\s*\(/.test(source));
 assert.ok(!source.includes("firebase-admin"));
 console.log("PASS Phase 15.6 transaction conflict and recovery integration with injected Firestore mock; no live writes");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
