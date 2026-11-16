"use strict";
const assert=require("node:assert/strict");
const {createBookingConflictRehearsal}=require("../functions/phase146BookingConflictRehearsal");
const now=1800000000000,owner="owner123";
const intent={serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"09:00"};
const profile={businessId:owner,published:true,acceptingBookings:false,
 services:[{id:"cut",published:true,durationMinutes:30}],
 staff:[{id:"kody",active:true,serviceIds:["cut"]}]};
const staff=[{id:"kody",weeklySchedule:{friday:{open:"09:00",close:"17:00"}},weeklyBreaks:[],timeOff:[]}];
const original={id:"original-1",staffId:"kody",date:"2026-11-20",time:"10:00",duration:30,client:"Private client"};
function fake({records=[original],retryRecords=null,age=0,offline=false,published=true}={}){
 let attempts=0;
 const writes=[],reads=[];
 const db={
  collection(name){return {doc(id){return {key:name==="publicBusinesses"?"public":null,
   collection(){return {doc(key){return {key};}}}};}};},
  async runTransaction(fn,options){
   assert.equal(options.maxAttempts,3);
   assert.equal(options.readOnly,true);
   if(offline)throw Error("network offline");
   async function execute(){
    attempts++;
    const values={public:{...profile,published},staff,bookings:attempts>1&&retryRecords!==null?retryRecords:records};
    return fn({
     async get(ref){
      reads.push({attempt:attempts,key:ref.key});
      const value=values[ref.key];
      return {exists:value!==undefined,updateTime:{toMillis:()=>now-age},metadata:{fromCache:false},
       get(k){return (ref.key==="public"?value:{schemaVersion:1,json:JSON.stringify(value)})?.[k];}};
     },
     set(){writes.push("set");throw Error("Write forbidden");},
     update(){writes.push("update");throw Error("Write forbidden");},
     create(){writes.push("create");throw Error("Write forbidden");},
     delete(){writes.push("delete");throw Error("Write forbidden");}
    });
   }
   const first=await execute();
   if(retryRecords!==null)return execute(); // simulate Firestore retry after concurrent edit
   return first;
  }
 };
 return {db,writes,reads,get attempts(){return attempts;}};
}
async function run(label,config,request,expected,attempts=1){
 const f=fake(config);
 const result=await createBookingConflictRehearsal(f.db,{clock:()=>now})(owner,request);
 assert.deepEqual(result,{status:expected,acceptingBookings:false,reservationCreated:false},label);
 assert.equal(f.attempts,attempts,label+" transaction attempts");
 assert.equal(f.reads.length,3*attempts,label+" complete reread on retry");
 assert.deepEqual(f.writes,[],label+" never writes");
 console.log("PASS",label);
}
async function main(){
 await run("free slot is only rehearsal",{},intent,"REHEARSAL_NO_KNOWN_CONFLICTS_ONLY");
 await run("original appointment protected",{}, {...intent,time:"10:00"},"EXISTING_BOOKING_CONFLICT");
 await run("overlap protected",{}, {...intent,time:"09:45"},"EXISTING_BOOKING_CONFLICT");
 await run("adjacent slot allowed",{}, {...intent,time:"10:30"},"REHEARSAL_NO_KNOWN_CONFLICTS_ONLY");
 await run("concurrent booking on retry",{retryRecords:[original,{...original,id:"second",time:"09:00"}]},intent,"EXISTING_BOOKING_CONFLICT",2);
 await run("concurrent staff schedule change",{}, {...intent,time:"08:30"},"OUTSIDE_WORKING_HOURS");
 await run("stale inputs",{age:300001},intent,"BOOKING_REHEARSAL_STALE");
 await run("unpublished business",{published:false},intent,"BOOKING_REHEARSAL_UNAVAILABLE");
 await run("malformed bookings",{records:[{id:"legacy",time:"10:00"}]},intent,"BOOKING_REHEARSAL_UNAVAILABLE");
 const offline=fake({offline:true});
 assert.deepEqual(await createBookingConflictRehearsal(offline.db,{clock:()=>now})(owner,intent),
  {status:"BOOKING_REHEARSAL_UNAVAILABLE",acceptingBookings:false,reservationCreated:false});
 assert.equal(offline.writes.length,0);
 const invalid=fake();
 assert.equal((await createBookingConflictRehearsal(invalid.db,{clock:()=>now})("../bad",intent)).status,
  "BOOKING_REHEARSAL_UNAVAILABLE");
 assert.equal(invalid.attempts,0);
 console.log("PASS Phase 14.6 concurrent retry rehearsal: zero booking writes, no customer endpoint");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
