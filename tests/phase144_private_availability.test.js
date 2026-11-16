"use strict";
const assert=require("node:assert/strict");
const {normalizeBookings,createPrivateAvailabilityReader}=require("../functions/phase144PrivateAvailability");
const ownerId="owner123";
const intent={serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"09:00"};
const publicData={businessId:ownerId,published:true,acceptingBookings:false,
 services:[{id:"cut",published:true,durationMinutes:30}],
 staff:[{id:"kody",active:true,serviceIds:["cut"]}]};
const staff=[{id:"kody",weeklySchedule:{friday:{open:"09:00",close:"17:00"}},weeklyBreaks:[],timeOff:[]}];
const bookings=[{id:"original-1",staffId:"kody",date:"2026-11-20",time:"10:00",duration:30,client:"Private customer",notes:"Private notes"}];
function fakeDb(overrides={}) {
 const data={publicBusinesses:{[ownerId]:publicData},staff,bookings,...overrides};
 const reads=[];
 function snap(value) {
  return {exists:value!==undefined,get:key=>value?.[key]};
 }
 function doc(name,id) {
  return {
   async get() {
    reads.push(name+"/"+id);
    return snap(data.publicBusinesses[id]);
   },
   collection(type) {
    return {
     doc(key) {
      return {
       async get() {
        reads.push(name+"/"+id+"/"+type+"/"+key);
        const value=data[key];
        return snap(value===undefined?undefined:{schemaVersion:1,json:JSON.stringify(value)});
       }
      };
     }
    };
   }
  };
 }
 return {reads,collection(name){return {doc(id){return doc(name,id);}};}};
}
async function main(){
 const cases=[
  ["free",{},intent,"NO_KNOWN_CONFLICTS_ONLY"],
  ["collision",{}, {...intent,time:"10:00"},"EXISTING_BOOKING_CONFLICT"],
  ["outside hours",{}, {...intent,time:"08:00"},"OUTSIDE_WORKING_HOURS"],
  ["missing booking document",{bookings:undefined},intent,"CLOUD_AVAILABILITY_UNAVAILABLE"],
  ["missing staff document",{staff:undefined},intent,"CLOUD_AVAILABILITY_UNAVAILABLE"],
  ["malformed legacy booking",{bookings:[{id:"original-1",date:"2026-11-20",time:"10:00",duration:30}]},intent,"CLOUD_AVAILABILITY_UNAVAILABLE"],
  ["duplicate booking IDs",{bookings:[bookings[0],bookings[0]]},intent,"CLOUD_AVAILABILITY_UNAVAILABLE"],
  ["business unpublished",{publicBusinesses:{[ownerId]:{...publicData,published:false}}},intent,"CLOUD_AVAILABILITY_UNAVAILABLE"],
  ["booking enabled unexpectedly",{publicBusinesses:{[ownerId]:{...publicData,acceptingBookings:true}}},intent,"CLOUD_AVAILABILITY_UNAVAILABLE"],
  ["wrong owner",{publicBusinesses:{[ownerId]:{...publicData,businessId:"another"}}},intent,"CLOUD_AVAILABILITY_UNAVAILABLE"]
 ];
 for(const [label,override,request,expected] of cases){
  const db=fakeDb(override);
  const result=await createPrivateAvailabilityReader(db)(ownerId,request);
  assert.equal(result.status,expected,label);
  assert.deepEqual(Object.keys(result).sort(),["acceptingBookings","status"],label+" only safe fields");
  assert.equal(result.acceptingBookings,false,label);
  assert.equal(db.reads.length,3,label+" exactly three owner-scoped reads");
  console.log("PASS",label);
 }
 const db=fakeDb();
 assert.equal((await createPrivateAvailabilityReader(db)("../other",intent)).status,"CLOUD_AVAILABILITY_UNAVAILABLE");
 assert.equal(db.reads.length,0,"invalid owner never read");
 assert.equal(normalizeBookings(bookings)[0].status,"confirmed");
 assert.equal(JSON.stringify(normalizeBookings(bookings)).includes("Private"),false);
 assert.equal(normalizeBookings([{...bookings[0],duration:undefined}]),null);
 console.log("PASS Phase 14.4 server-only cloud availability; no writes or private data leaks");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
