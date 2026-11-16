"use strict";
const assert=require("node:assert/strict");
const {createDisabledAtomicReservation,DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const now=1800000000000,owner="owner123";
const intent={serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"09:00"};
const profile={businessId:owner,published:true,acceptingBookings:false,
 services:[{id:"cut",published:true,durationMinutes:30}],
 staff:[{id:"kody",active:true,serviceIds:["cut"]}]};
const staff=[{id:"kody",weeklySchedule:{friday:{open:"09:00",close:"17:00"}},weeklyBreaks:[],timeOff:[]}];
const original={id:"original",staffId:"kody",date:"2026-11-20",time:"10:00",duration:30,client:"private"};
function fake({records=[original],retryRecords=null,age=0,fail=false}={}){
 const reads=[],writes=[];let attempts=0;
 const db={
  collection(name){return {doc(id){return {key:name==="publicBusinesses"?"public":null,
   collection(){return {doc(key){return {key};}}}};}};},
  async runTransaction(fn,options){
   assert.equal(options.readOnly,true);assert.equal(options.maxAttempts,3);
   if(fail)throw Error("offline");
   const execute=async()=>{
    attempts++;
    const data={public:profile,staff,bookings:attempts>1&&retryRecords!==null?retryRecords:records};
    return fn({
     async get(ref){
      reads.push(ref.key);
      const value=data[ref.key];
      return {exists:value!==undefined,metadata:{fromCache:false},
       updateTime:{toMillis:()=>now-age},
       get(key){return (ref.key==="public"?value:{schemaVersion:1,json:JSON.stringify(value)})?.[key];}};
     },
     set(){writes.push("set");throw Error("write forbidden");},
     create(){writes.push("create");throw Error("write forbidden");},
     update(){writes.push("update");throw Error("write forbidden");},
     delete(){writes.push("delete");throw Error("write forbidden");}
    });
   };
   const first=await execute();
   return retryRecords!==null?execute():first;
  }
 };
 return {db,reads,writes,get attempts(){return attempts;}};
}
async function main(){
 const f=fake();
 const engine=createDisabledAtomicReservation(f.db,{clock:()=>now});
 for(const request of [intent,{...intent,time:"10:00"},null,{}, {enabled:true,...intent}]){
  assert.deepEqual(await engine.reserve(owner,request),DISABLED);
 }
 assert.equal(f.reads.length,0,"disabled reservation never accesses database");
 assert.equal(f.attempts,0,"disabled reservation never opens transaction");
 assert.equal(f.writes.length,0,"disabled reservation never writes");
 assert.deepEqual(await engine.inspect(owner,intent),
  {status:"ATOMIC_RESERVATION_PREPARED_ONLY",acceptingBookings:false,reservationCreated:false});
 assert.deepEqual(await engine.inspect(owner,{...intent,time:"10:00"}),
  {status:"EXISTING_BOOKING_CONFLICT",acceptingBookings:false,reservationCreated:false});
 assert.deepEqual(f.writes,[],"inspection never writes");
 const concurrent=fake({retryRecords:[original,{...original,id:"second",time:"09:00"}]});
 assert.deepEqual(await createDisabledAtomicReservation(concurrent.db,{clock:()=>now}).inspect(owner,intent),
  {status:"EXISTING_BOOKING_CONFLICT",acceptingBookings:false,reservationCreated:false});
 assert.equal(concurrent.attempts,2,"rechecks after simulated concurrent change");
 assert.equal(concurrent.writes.length,0);
 const stale=fake({age:300001});
 assert.equal((await createDisabledAtomicReservation(stale.db,{clock:()=>now}).inspect(owner,intent)).status,
  "RESERVATION_SNAPSHOT_UNAVAILABLE");
 const bad=fake({records:[{id:"old",date:"2026-11-20"}]});
 assert.equal((await createDisabledAtomicReservation(bad.db,{clock:()=>now}).inspect(owner,intent)).status,
  "RESERVATION_SNAPSHOT_UNAVAILABLE");
 const offline=fake({fail:true});
 assert.deepEqual(await createDisabledAtomicReservation(offline.db).reserve(owner,intent),DISABLED);
 assert.equal((await createDisabledAtomicReservation(offline.db).inspect(owner,intent)).status,
  "RESERVATION_SNAPSHOT_UNAVAILABLE");
 assert.equal(offline.writes.length,0);
 assert.equal((await engine.inspect("../invalid",intent)).status,"RESERVATION_SNAPSHOT_UNAVAILABLE");
 assert.equal(f.reads.length,6,"invalid owner never reads");
 console.log("PASS Phase 14.7 hard-disabled reservation, atomic snapshot rehearsal, no writes");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
