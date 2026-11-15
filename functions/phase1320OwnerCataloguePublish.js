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
// Matches ManagementActivity.kt: price is a decimal string, duration is an
// integer, and publicVisible is the explicit opt-in on BOTH record types.
function pricePence(value){
 if(typeof value!=="string"||!/^\d{1,6}\.\d{2}$/.test(value))return null;
 const [penceMajor,penceMinor]=value.split(".");
 const amount=Number(penceMajor)*100+Number(penceMinor);
 return Number.isSafeInteger(amount)&&amount<=10000000?amount:null;
}
function project(services,staff){
 if(!Array.isArray(services)||!Array.isArray(staff)||services.length>100||staff.length>50)return null;
 const approvedServices=[];
 for(const s of services){
  if(!s||typeof s!=="object"||Array.isArray(s))return null;
  if(s.publicVisible!==true)continue;
  const price=pricePence(s.price);
  if(price===null||!Number.isSafeInteger(s.duration))return null;
  approvedServices.push({id:s.id,name:s.name,pricePence:price,
   durationMinutes:s.duration,published:true});
 }
 const publicIds=new Set(approvedServices.map(s=>s.id));
 const approvedStaff=[];
 for(const person of staff){
  if(!person||typeof person!=="object"||Array.isArray(person))return null;
  if(person.publicVisible!==true)continue;
  if(!Array.isArray(person.serviceIds))return null;
  approvedStaff.push({id:person.id,name:person.name,active:true,
   serviceIds:person.serviceIds.filter(id=>publicIds.has(id))});
 }
 return safeCatalogue({get:key=>key==="services"?approvedServices:approvedStaff});
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
