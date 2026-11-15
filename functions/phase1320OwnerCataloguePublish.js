"use strict";
// Phase 13.20: verified-owner, explicit public catalogue publishing.
// Private liveData JSON is read server-side only, never returned to clients.
// Fail closed on unknown formats rather than guessing Android's data schema.
const {safeCatalogue}=require("./phase1319PublicCatalogue");
function parseDocument(snapshot){
 if(!snapshot.exists)return null;
 const json=snapshot.get("json");
 if(snapshot.get("schemaVersion")!==1||typeof json!=="string"||json.length>500000)return null;
 try{const value=JSON.parse(json);return Array.isArray(value)?value:null;}catch{return null;}
}
function project(services,staff){
 if(!Array.isArray(services)||!Array.isArray(staff)||services.length>100||staff.length>50)return null;
 // Only explicit owner-approved public fields are eligible.
 const approvedServices=services.map(s=>({
  id:s?.id,name:s?.name,pricePence:s?.pricePence,
  durationMinutes:s?.durationMinutes,published:s?.published===true
 }));
 const approvedStaff=staff.map(s=>({
  id:s?.id,name:s?.name,active:s?.publiclyListed===true&&s?.active===true,
  serviceIds:s?.serviceIds
 }));
 const snapshot={get:key=>key==="services"?approvedServices:approvedStaff};
 const output=safeCatalogue(snapshot);
 if(!output)return null;
 // If malformed active entries were silently omitted, refuse publishing.
 if(approvedServices.some(s=>s.published!==true&&s.published!==false))return null;
 return output;
}
async function publishOwnerCatalogue(db,uid){
 if(typeof uid!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(uid))throw new Error("INVALID_OWNER");
 const owner=db.collection("users").doc(uid);
 const [servicesDoc,staffDoc]=await Promise.all([
  owner.collection("liveData").doc("services").get(),
  owner.collection("liveData").doc("staff").get()
 ]);
 const services=parseDocument(servicesDoc),staff=parseDocument(staffDoc);
 const catalogue=project(services,staff);
 if(!catalogue) return {status:"CATALOGUE_FORMAT_UNSUPPORTED"};
 const publicRef=db.collection("publicBusinesses").doc(uid);
 return db.runTransaction(async tx=>{
  const published=await tx.get(publicRef);
  if(!published.exists||published.get("published")!==true||published.get("businessId")!==uid)
   return {status:"BUSINESS_NOT_PUBLISHED"};
  tx.update(publicRef,{services:catalogue.services.map(s=>({...s,published:true})),
   staff:catalogue.staff.map(s=>({...s,active:true})),acceptingBookings:false});
  return {status:"CATALOGUE_PUBLISHED",serviceCount:catalogue.services.length,staffCount:catalogue.staff.length};
 });
}
module.exports=Object.freeze({parseDocument,project,publishOwnerCatalogue});
