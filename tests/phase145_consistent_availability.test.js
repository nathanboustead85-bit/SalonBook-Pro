"use strict";
const assert=require("node:assert/strict");
const {createConsistentAvailabilityReader,MAX_AGE_MS}=require("../functions/phase145ConsistentAvailability");
const now=1800000000000,owner="owner123";
const intent={serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"09:00"};
const pub={businessId:owner,published:true,acceptingBookings:false,
 services:[{id:"cut",published:true,durationMinutes:30}],
 staff:[{id:"kody",active:true,serviceIds:["cut"]}]};
const staff=[{id:"kody",weeklySchedule:{friday:{open:"09:00",close:"17:00"}},weeklyBreaks:[],timeOff:[]}];
const bookings=[{id:"original",staffId:"kody",date:"2026-11-20",time:"10:00",duration:30,client:"Secret"}];
function dbFake({age=0,ages=null,cache=false,missing=null,fail=false,publicData=pub,staffData=staff,bookingData=bookings}={}){
 const data={public:publicData,staff:staffData,bookings:bookingData},reads=[],writes=[];
 const db={
  collection(name){return {doc(id){return {
   key:name==="publicBusinesses"?"public":null,
   collection(sub){return {doc(key){return {key};}}}
  };}};},
  async runTransaction(fn,options){
   assert.equal(options.maxAttempts,3);
   if(fail)throw Error("offline");
   return fn({
    async get(ref){
     reads.push(ref.key);
     const key=ref.key,value=data[key],index=["public","staff","bookings"].indexOf(key);
     const timestamp=now-(ages?ages[index]:age);
     return {exists:value!==undefined,metadata:{fromCache:cache},
      updateTime:{toMillis:()=>timestamp},
      get(k){return (key==="public"?value:{schemaVersion:1,json:JSON.stringify(value)})?.[k];}};
    },
    set(...args){writes.push(args);throw Error("Writes prohibited");},
    update(...args){writes.push(args);throw Error("Writes prohibited");},
    create(...args){writes.push(args);throw Error("Writes prohibited");},
    delete(...args){writes.push(args);throw Error("Writes prohibited");}
   });
  }
 };
 return {db,reads,writes};
}
async function check(label,config,request,expected){
 const {db,reads,writes}=dbFake(config);
 const result=await createConsistentAvailabilityReader(db,{clock:()=>now})(owner,request);
 assert.deepEqual(result,{status:expected,acceptingBookings:false},label);
 assert.deepEqual(reads,["public","staff","bookings"],label+" same transaction reads");
 assert.equal(writes.length,0,label+" never writes");
 console.log("PASS",label);
}
async function main(){
 await check("fresh and free",{},intent,"NO_KNOWN_CONFLICTS_ONLY");
 await check("booking collision",{}, {...intent,time:"10:00"},"EXISTING_BOOKING_CONFLICT");
 await check("freshness boundary",{age:MAX_AGE_MS},intent,"NO_KNOWN_CONFLICTS_ONLY");
 await check("stale bookings",{ages:[0,0,MAX_AGE_MS+1]},intent,"CLOUD_SNAPSHOT_STALE");
 await check("stale staff",{ages:[0,MAX_AGE_MS+1,0]},intent,"CLOUD_SNAPSHOT_STALE");
 await check("stale public catalogue",{ages:[MAX_AGE_MS+1,0,0]},intent,"CLOUD_SNAPSHOT_STALE");
 await check("future timestamp",{age:-1},intent,"CLOUD_SNAPSHOT_STALE");
 await check("cache rejected",{cache:true},intent,"CLOUD_SNAPSHOT_STALE");
 await check("missing cloud bookings",{bookingData:undefined},intent,"CLOUD_SNAPSHOT_STALE");
 await check("published booking switch",{publicData:{...pub,acceptingBookings:true}},intent,"CLOUD_AVAILABILITY_UNAVAILABLE");
 await check("malformed legacy",{bookingData:[{id:"old",time:"09:00"}]},intent,"CLOUD_AVAILABILITY_UNAVAILABLE");
 const offline=dbFake({fail:true});
 assert.deepEqual(await createConsistentAvailabilityReader(offline.db,{clock:()=>now})(owner,intent),
  {status:"CLOUD_AVAILABILITY_UNAVAILABLE",acceptingBookings:false});
 assert.equal(offline.writes.length,0);
 const invalid=dbFake();
 assert.equal((await createConsistentAvailabilityReader(invalid.db,{clock:()=>now})("../other",intent)).status,
  "CLOUD_AVAILABILITY_UNAVAILABLE");
 assert.equal(invalid.reads.length,0);
 assert.throws(()=>createConsistentAvailabilityReader(invalid.db,{maxAgeMs:MAX_AGE_MS+1}),TypeError);
 console.log("PASS Phase 14.5 read-only freshness and transaction preflight, no booking writes");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
