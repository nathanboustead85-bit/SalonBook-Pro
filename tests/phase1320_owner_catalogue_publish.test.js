"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const {parseDocument,project,publishOwnerCatalogue}=require("../functions/phase1320OwnerCataloguePublish");
const snapshot=(data)=>({exists:!!data,get:key=>data?.[key]});
const services=[{id:"cut",name:"Haircut",price:"20.00",duration:30,publicVisible:true,privateNotes:"SECRET"}];
const staff=[{id:"kody",name:"Kody",publicVisible:true,serviceIds:["cut"],email:"PRIVATE"}];
function fixture(publicData={published:true,businessId:"owner"},serviceData=services,staffData=staff){
 const writes=[],reads=[];
 const docs={
  "users/owner/liveData/services":serviceData===null?null:{schemaVersion:1,json:JSON.stringify(serviceData)},
  "users/owner/liveData/staff":staffData===null?null:{schemaVersion:1,json:JSON.stringify(staffData)},
  "publicBusinesses/owner":publicData
 };
 const db={collection(name){return {doc(id){const path=name+"/"+id;return {
  path,collection(child){return {doc(key){return {path:path+"/"+child+"/"+key,get:async()=>{reads.push(path+"/"+child+"/"+key);return snapshot(docs[path+"/"+child+"/"+key]);}};}};},
  get:async()=>snapshot(docs[path])
 };}};},async runTransaction(callback){return callback({get:async ref=>{reads.push(ref.path);return snapshot(docs[ref.path]);},update:(ref,value)=>writes.push({path:ref.path,value})});}};
 return {db,writes,reads};
}
(async()=>{
 assert.equal(parseDocument(snapshot({schemaVersion:1,json:"{}"})),null);
 assert.equal(parseDocument(snapshot({schemaVersion:1,json:"not json"})),null);
 assert.deepEqual(project([{...services[0],publicVisible:false}],staff),{services:[],staff:[{id:"kody",name:"Kody",serviceIds:[]}]});
 assert.equal(project(services,[{...staff[0],publicVisible:false}]).staff.length,0);
 let f=fixture(),result=await publishOwnerCatalogue(f.db,"owner");
 assert.equal(result.status,"CATALOGUE_PUBLISHED");
 assert.equal(f.writes.length,1);
 assert.deepEqual(f.writes[0].value,{services:[{id:"cut",name:"Haircut",pricePence:2000,durationMinutes:30,published:true}],staff:[{id:"kody",name:"Kody",serviceIds:["cut"],active:true}],acceptingBookings:false});
 assert.ok(!JSON.stringify(f.writes).includes("SECRET"));
 assert.ok(!JSON.stringify(f.writes).includes("PRIVATE"));
 assert.ok(f.reads.every(p=>p.startsWith("users/owner/liveData/")||p==="publicBusinesses/owner"));
 f=fixture({published:false,businessId:"owner"});
 result=await publishOwnerCatalogue(f.db,"owner");assert.equal(result.status,"BUSINESS_NOT_PUBLISHED");assert.equal(f.writes.length,0);
 f=fixture(undefined,null,staff);
 result=await publishOwnerCatalogue(f.db,"owner");assert.equal(result.status,"CATALOGUE_FORMAT_UNSUPPORTED");assert.equal(f.writes.length,0);
 const source=fs.readFileSync(require.resolve("../functions/index.js"),"utf8");
 assert.match(source,/exports\.publishPublicCatalogue = onCall/);
 assert.match(source,/const uid=verifiedUser\(request\)/);
 console.log("PASS Phase 13.20 explicit owner publication, private field stripping, fail-closed schema and no booking");
})().catch(e=>{console.error(e);process.exitCode=1});
