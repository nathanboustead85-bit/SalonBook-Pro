"use strict";
/** Phase 11.5 local emulator-only customer journey. Never export from functions/index.js. */
const {guard,createDemoBookingEngine}=require("./phase113DemoBookingEngine");
const {evaluateSchedule,createVerifiedCustomer,localDay}=require("./phase114UkSchedule");
const ID=/^[A-Za-z0-9_-]{3,80}$/;
function fail(message){throw Error("phase115 "+message);}
function createDemoJourney({db,auth}){
 guard();
 if(!db||!auth)fail("trusted emulator dependencies required");
 const engine=createDemoBookingEngine({db,verifyCustomer:createVerifiedCustomer({auth}),scheduleValidator:evaluateSchedule});
 function businessRef(id){if(typeof id!=="string"||!id.startsWith("demo_")||!ID.test(id))fail("synthetic business required");return db.collection("phase113DemoBusinesses").doc(id);}
 async function catalogue(businessId){
  guard();const b=businessRef(businessId);
  const [services,staff]=await Promise.all([b.collection("services").get(),b.collection("staff").get()]);
  return {businessId,services:services.docs.filter(x=>x.get("active")===true).map(x=>({id:x.id,name:x.get("name")||x.id,durationMinutes:x.get("durationMinutes")})),staff:staff.docs.filter(x=>x.get("active")===true).map(x=>({id:x.id,name:x.get("name")||x.id,serviceIds:x.get("serviceIds")||[]}))};
 }
 async function availability({businessId,serviceId,staffId,date}){
  guard();const b=businessRef(businessId);
  if(!ID.test(serviceId||"")||!ID.test(staffId||"")||typeof date!=="string"||!/^\d{4}-\d\d-\d\d$/.test(date)||Number.isNaN(Date.parse(date+"T00:00:00Z"))||new Date(date+"T00:00:00Z").toISOString().slice(0,10)!==date)fail("invalid availability request");
  const [service,staff,profile]=await Promise.all([b.collection("services").doc(serviceId).get(),b.collection("staff").doc(staffId).get(),b.get()]);
  if(!service.exists||!staff.exists||service.get("active")!==true||staff.get("active")!==true||!staff.get("serviceIds")?.includes(serviceId))return [];
  const duration=service.get("durationMinutes");
  if(!Number.isInteger(duration)||duration<5||duration>480)fail("invalid service duration");
  const calendar=b.collection("staffDays").doc(staffId+"_"+date);
  const snapshot=await calendar.get(),slots=snapshot.exists?snapshot.get("slots")||[]:[];
  if(!Array.isArray(slots))fail("invalid calendar");
  const output=[];
  // UTC minute candidates cover the entire London local date, including DST shifts.
  const base=Date.parse(date+"T00:00:00Z");
  for(let ms=base-3600000;ms<base+25*3600000;ms+=15*60000){
   if(localDay(ms)!==date)continue;
   try{evaluateSchedule({startMs:ms,durationMinutes:duration,staff:staff.data(),closures:profile.get("closures")||[]});}
   catch{continue;}
   if(slots.some(s=>ms<s.end&&ms+duration*60000>s.start))continue;
   output.push(new Date(ms).toISOString());
  }
  return output;
 }
 async function book(request){
  guard();
  const result=await engine.book(request);
  return result;
 }
 return Object.freeze({catalogue,availability,book});
}
module.exports={createDemoJourney};
