"use strict";
const assert=require("node:assert/strict"),admin=require("../functions/node_modules/firebase-admin");
const {stageFromAndroid}=require("../functions/phase1248StagingBridge");
const projectId="demo-boustio-phase1245",emulatorHost="127.0.0.1:8080",businessId="demo-owner",slug="demo-salon";
if(process.env.GCLOUD_PROJECT!==projectId||process.env.FIRESTORE_EMULATOR_HOST!==emulatorHost)
 throw Error("REFUSING: isolated emulator required");
admin.initializeApp({projectId});
const db=admin.firestore(),root=db.collection("phase1245Owners").doc(businessId),now=Date.now();
const args={projectId,emulatorHost,businessId,slug,date:"2026-11-20",generatedAt:now};
const doc=x=>({json:JSON.stringify(x),schemaVersion:1,updatedAt:new Date()});
async function main(){
 try{
  await assert.rejects(stageFromAndroid(db,{...args,projectId:"salonbook-pro-ad5ff"}),/REFUSING/);
  console.log("PASS production Firebase refused");
  await assert.rejects(stageFromAndroid(db,{...args,businessId:"real-owner"}),/REFUSING/);
  console.log("PASS non-synthetic owner refused");
  assert.equal((await stageFromAndroid(db,args)).status,"UNAVAILABLE");
  console.log("PASS absent Android source unavailable");
  await root.collection("business").doc("profile").set({businessId,name:"Demo Salon",slug,published:true,acceptingBookings:false,schemaVersion:1,phone:"PRIVATE PHONE"});
  await root.collection("liveData").doc("services").set(doc([
   {id:"cut",name:"Haircut",price:"20.00",duration:30,publicVisible:true},
   {id:"secret",name:"Secret treatment",price:"99",duration:60,publicVisible:false}]));
  await root.collection("liveData").doc("staff").set(doc([{id:"alex",name:"Alex",publicVisible:true,
   serviceIds:["cut"],weeklySchedule:{friday:{open:"09:00",close:"12:00"}},
   weeklyBreaks:[{day:"friday",start:"10:00",end:"10:30",reason:"PRIVATE BREAK"}],timeOff:[]}]));
  await root.collection("liveData").doc("bookings").set(doc([{id:"original-synthetic",
   client:"PRIVATE CLIENT",notes:"PRIVATE NOTES",staffId:"alex",serviceId:"cut",
   date:"2026-11-20",time:"09:30",duration:30}]));
  const staged=await stageFromAndroid(db,{...args,generatedAt:now+1});
  assert.equal(staged.status,"STAGING_PREVIEW");assert.equal(staged.bookingEnabled,false);
  console.log("PASS Android cloud schema flows through emulator to staging preview");
  assert.equal(staged.services.length,1);assert.equal(staged.services[0].pricePence,2000);
  console.log("PASS only published service and correct price visible");
  const times=staged.availability.find(a=>a.staffId==="alex").times;
  for(const t of ["09:30","10:00"])assert.equal(times.includes(t),false);
  console.log("PASS booked time and staff break removed from slots");
  const serialized=JSON.stringify(staged);
  for(const text of ["PRIVATE CLIENT","PRIVATE NOTES","PRIVATE PHONE","PRIVATE BREAK","Secret treatment","original-synthetic"])
   assert.equal(serialized.includes(text),false);
  console.log("PASS no private booking, phone, break or hidden service data exported");
  assert.equal(staged.source,"SYNTHETIC_EMULATOR");
  console.log("PASS synthetic provenance is explicit");
  await root.collection("business").doc("profile").update({published:false});
  assert.equal((await stageFromAndroid(db,{...args,generatedAt:now+2})).status,"UNAVAILABLE");
  console.log("PASS unpublished business withdraws staging preview");
  await root.collection("business").doc("profile").update({published:true});
  await root.collection("liveData").doc("bookings").set({json:"invalid",schemaVersion:1});
  assert.equal((await stageFromAndroid(db,{...args,generatedAt:now+3})).status,"UNAVAILABLE");
  console.log("PASS corrupted Android data fails closed");
  assert.equal((await db.collection("phase1245PublicAvailability").doc(businessId).get()).exists,false);
  console.log("PASS invalid data removes public emulator snapshot");
 }finally{await admin.app().delete()}
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
