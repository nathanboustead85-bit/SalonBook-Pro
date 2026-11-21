"use strict";
// Phase 33.2: isolated legacy Android services mapper; no Firebase access.
const {adaptDashboardSnapshot}=require("./dashboard-adapter-33-1");
const {MAX_JSON_CHARS,MAX_RECORDS}=require("../phase32/content-validation-32-9");
const fail=reason=>Object.freeze({status:"UNAVAILABLE",reason,bookingEnabled:false,editingEnabled:false,business:null,services:Object.freeze([])});
const obj=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
function mapLegacyServices(snapshot){
 if(!obj(snapshot)||snapshot.schemaVersion!==1||typeof snapshot.json!=="string")return fail("invalid_envelope");
 if(snapshot.json.length>MAX_JSON_CHARS)return fail("oversized_payload");
 let data;try{data=JSON.parse(snapshot.json)}catch{return fail("malformed_json")}
 if(!Array.isArray(data)||data.length>MAX_RECORDS)return fail("invalid_collection");
 const seen=new Set(),mapped=[];
 for(const s of data){
  if(!obj(s)||typeof s.id!=="string"||!/^[A-Za-z0-9_-]{1,64}$/.test(s.id)||seen.has(s.id)||
     typeof s.name!=="string"||!s.name.trim()||s.name.length>150||
     typeof s.price!=="string"||! /^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(s.price)||
     !Number.isInteger(s.duration)||s.duration<1||s.duration>480||
     (s.publicVisible!==undefined&&typeof s.publicVisible!=="boolean"))return fail("invalid_legacy_service");
  const [whole,fraction=""]=s.price.split(".");
  const pence=Number(whole)*100+Number(fraction.padEnd(2,"0"));
  if(!Number.isSafeInteger(pence)||pence>10000000)return fail("invalid_price");
  seen.add(s.id);
  mapped.push({id:s.id,name:s.name,pricePence:pence,durationMinutes:s.duration,active:s.publicVisible===true});
 }
 return Object.freeze({status:"MAPPED_READ_ONLY",bookingEnabled:false,services:Object.freeze(mapped.map(s=>Object.freeze(s)))});
}
function adaptLegacyDashboard(input,context){
 if(!input||input.loading===true)return adaptDashboardSnapshot(input,context);
 if(!input.services)return fail("missing_services");
 const mapped=mapLegacyServices(input.services);
 if(mapped.status!=="MAPPED_READ_ONLY")return fail(mapped.reason);
 const normalized={...input,services:{schemaVersion:1,json:JSON.stringify(mapped.services)}};
 return adaptDashboardSnapshot(normalized,context);
}
module.exports=Object.freeze({mapLegacyServices,adaptLegacyDashboard});
