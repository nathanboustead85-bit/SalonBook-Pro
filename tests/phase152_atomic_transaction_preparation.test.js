"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createAtomicTransactionPreparation}=require("../functions/phase152AtomicTransactionPreparation");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const secret="phase152-test-secret-at-least-32-bytes-long";
const input={ownerId:"owner1",key:"request_1234",intent:{serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"10:00"},secret};
function fakeDb({requestExists=false,published=true,fail=false,missing=false}={}){
 const trace=[];
 const db={
  collection(name){
   return {doc(id){const p=name+"/"+id;return ref(p);}};
  },
  async runTransaction(fn,options){
   trace.push(["transaction",options]);
   if(fail)throw Error("offline");
   return fn({
    async get(doc){
     trace.push(["get",doc.path]);
     if(missing&&doc.path.endsWith("/staff"))return {exists:false,get:()=>undefined};
     if(doc.path.startsWith("publicBusinesses/"))
      return {exists:true,get:k=>({businessId:"owner1",published,acceptingBookings:false})[k]};
     if(doc.path.includes("/customerBookingRequests/"))
      return {exists:requestExists,get:()=>undefined};
     return {exists:true,get:()=>undefined};
    },
    set(){throw Error("write attempted");},create(){throw Error("write attempted");},
    update(){throw Error("write attempted");},delete(){throw Error("write attempted");}
   });
  }
 };
 function ref(p){return {path:p,collection(name){return {doc(id){return ref(p+"/"+name+"/"+id);}}}};}
 return {db,trace};
}
async function main(){
 const good=fakeDb();
 const api=createAtomicTransactionPreparation(good.db);
 const result=await api.inspect(input);
 assert.equal(result.status,"ATOMIC_PREPARATION_READ_ONLY");
 assert.equal(result.acceptingBookings,false);
 assert.equal(result.reservationCreated,false);
 assert.equal(good.trace.filter(t=>t[0]==="get").length,4);
 assert.deepEqual(good.trace[0][1],{maxAttempts:3,readOnly:true});
 assert.ok(good.trace.every(t=>t[0]!=="write"));
 assert.deepEqual(await api.reserve(input),DISABLED);
 for(const [opts,expected] of [
  [{requestExists:true},"ATOMIC_PREPARATION_EXISTING_REQUEST_REQUIRES_RECOVERY"],
  [{published:false},"ATOMIC_PREPARATION_UNAVAILABLE"],
  [{missing:true},"ATOMIC_PREPARATION_UNAVAILABLE"],
  [{fail:true},"ATOMIC_PREPARATION_UNAVAILABLE"]
 ]){
  const fixture=fakeDb(opts);
  assert.equal((await createAtomicTransactionPreparation(fixture.db).inspect(input)).status,expected);
 }
 assert.equal((await api.inspect({...input,ownerId:"../bad"})).status,"ATOMIC_PREPARATION_INVALID");
 assert.throws(()=>createAtomicTransactionPreparation({}),TypeError);
 const source=fs.readFileSync(path.resolve(__dirname,"../functions/phase152AtomicTransactionPreparation.js"),"utf8");
 assert.ok(!/\btx\.(?:set|create|update|delete)\s*\(/.test(source));
 assert.ok(!source.includes("firebase-admin"));
 const entry=fs.readFileSync(path.resolve(__dirname,"../functions/index.js"),"utf8");
 assert.ok(!entry.includes("phase152AtomicTransactionPreparation"),"must not expose endpoint");
 console.log("PASS Phase 15.2 read-only Firestore transaction preparation, fail-closed, no booking writes");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
