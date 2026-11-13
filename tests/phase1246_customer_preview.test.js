"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const admin=require("../functions/node_modules/firebase-admin");
const api=require("../web/phase1246/publicAvailabilityReader");
const projectId="demo-boustio-phase1245",host="127.0.0.1:8080";
if(process.env.GCLOUD_PROJECT!==projectId||process.env.FIRESTORE_EMULATOR_HOST!==host)
 throw Error("REFUSING: emulator-only customer preview");
admin.initializeApp({projectId});
const db=admin.firestore(),pub=db.collection("phase1245PublicAvailability").doc("demo-owner");
const now=Date.now(),base={status:"PUBLIC_PREVIEW",schemaVersion:1,businessId:"demo-owner",
 slug:"demo-salon",businessName:"Demo Salon",date:"2026-11-20",generatedAt:now,
 bookingEnabled:false,services:[{id:"cut",name:"Haircut",pricePence:2000,durationMinutes:30}],
 availability:[{serviceId:"cut",staffId:"alex",times:["09:00","10:30"]}]};
const args={slug:"demo-salon",now};
function check(name,fn){fn();console.log("PASS "+name)}
async function main(){
 try{
  check("valid public snapshot renders safe service and slots",()=>{
   const x=api.view({...base,expiresAt:now+300000},args);
   assert.equal(x.status,"READ_ONLY");assert.deepEqual(x.availability[0].times,["09:00","10:30"]);
  });
  check("booking stays disabled",()=>assert.equal(api.view({...base,expiresAt:now+300000},args).bookingEnabled,false));
  check("wrong slug denied",()=>assert.equal(api.view({...base,expiresAt:now+300000},{slug:"other",now}).status,"UNAVAILABLE"));
  check("expired snapshot denied",()=>assert.equal(api.view({...base,expiresAt:now-1},args).status,"UNAVAILABLE"));
  check("stale generation denied",()=>assert.equal(api.view({...base,generatedAt:now-300001,expiresAt:now+1000},args).status,"UNAVAILABLE"));
  check("future generation denied",()=>assert.equal(api.view({...base,generatedAt:now+1,expiresAt:now+300000},args).status,"UNAVAILABLE"));
  check("booking enabled snapshot denied",()=>assert.equal(api.view({...base,bookingEnabled:true,expiresAt:now+300000},args).status,"UNAVAILABLE"));
  check("malformed slots denied",()=>assert.equal(api.view({...base,availability:[{serviceId:"cut",staffId:"alex",times:["oops"]}],expiresAt:now+300000},args).status,"UNAVAILABLE"));
  check("wrong service reference denied",()=>assert.equal(api.view({...base,availability:[{serviceId:"unknown",staffId:"alex",times:[]}],expiresAt:now+300000},args).status,"UNAVAILABLE"));
  check("production URL rejected",()=>assert.equal(api.load({slug:"demo-salon",now,origin:"https://salonbook-pro-ad5ff.web.app",fetcher:fetch}) instanceof Promise,true));
  const html=fs.readFileSync("web/phase1246/index.html","utf8");
  check("web page includes visible read-only warning",()=>assert.match(html,/READ-ONLY DEMO/));
  check("web page does not submit bookings",()=>assert.doesNotMatch(html,/fetch\s*\([^)]*method:\s*["']POST/));
  await pub.set({...base,expiresAt:new Date(now+300000)});
  const url="http://127.0.0.1:8080";
  const result=await api.load({slug:"demo-salon",now,origin:url,fetcher:fetch});
  assert.equal(result.status,"READ_ONLY");
  assert.equal(result.services[0].name,"Haircut");
  console.log("PASS customer reader fetches actual public Firestore emulator document");
  assert.equal((await api.load({slug:"other",now,origin:url,fetcher:fetch})).status,"UNAVAILABLE");
  console.log("PASS mismatched salon link fails closed");
  await pub.update({expiresAt:new Date(now-1000)});
  assert.equal((await api.load({slug:"demo-salon",now,origin:url,fetcher:fetch})).status,"UNAVAILABLE");
  console.log("PASS expired document cannot be fetched publicly");
  await pub.delete();
  assert.equal((await api.load({slug:"demo-salon",now,origin:url,fetcher:fetch})).status,"UNAVAILABLE");
  console.log("PASS withdrawn document displays unavailable state");
  const denied=await api.load({slug:"demo-salon",now,origin:"https://firestore.googleapis.com",fetcher:()=>{throw Error("should not fetch")}});
  assert.equal(denied.status,"UNAVAILABLE");
  console.log("PASS production Firestore endpoint cannot be contacted");
 }finally{await pub.delete();await admin.app().delete()}
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
