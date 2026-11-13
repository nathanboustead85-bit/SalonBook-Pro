"use strict";
// Phase 12.46: read-only Firestore emulator customer preview. No production URL.
(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.BoustioPhase1246=api;
})(typeof window!=="undefined"?window:null,function(){
 const PROJECT="demo-boustio-phase1245",COLLECTION="phase1245PublicAvailability";
 const unavailable=()=>({status:"UNAVAILABLE",bookingEnabled:false,services:[],availability:[]});
 function safeSlug(s){return typeof s==="string"&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)&&s.length<=50}
 function decodeField(v){
  if(!v||typeof v!=="object")throw Error("INVALID_FIELD");
  if(Object.hasOwn(v,"stringValue"))return v.stringValue;
  if(Object.hasOwn(v,"booleanValue"))return v.booleanValue;
  if(Object.hasOwn(v,"integerValue"))return Number(v.integerValue);
  if(Object.hasOwn(v,"timestampValue"))return Date.parse(v.timestampValue);
  if(Object.hasOwn(v,"arrayValue"))return (v.arrayValue.values||[]).map(decodeField);
  if(Object.hasOwn(v,"mapValue"))return Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,decodeField(x)]));
  throw Error("UNSUPPORTED_FIELD");
 }
 function parseFirestore(doc){return Object.fromEntries(Object.entries(doc.fields||{}).map(([k,v])=>[k,decodeField(v)]))}
 function view(snapshot,{slug,now}={}){
  const deny=unavailable();
  if(!snapshot||snapshot.status!=="PUBLIC_PREVIEW"||snapshot.bookingEnabled!==false||
   snapshot.schemaVersion!==1||snapshot.slug!==slug||!safeSlug(slug)||
   !Number.isSafeInteger(now)||!Number.isSafeInteger(snapshot.generatedAt)||
   now<snapshot.generatedAt||now-snapshot.generatedAt>300000||
   !Number.isFinite(snapshot.expiresAt)||now>=snapshot.expiresAt||
   typeof snapshot.businessName!=="string"||snapshot.businessName.length>100||
   typeof snapshot.date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(snapshot.date)||
   !Array.isArray(snapshot.services)||!Array.isArray(snapshot.availability))return deny;
  const services=[];
  for(const s of snapshot.services){
   if(!s||typeof s.id!=="string"||typeof s.name!=="string"||
    !Number.isSafeInteger(s.pricePence)||s.pricePence<0||
    !Number.isInteger(s.durationMinutes)||s.durationMinutes<1)return deny;
   services.push({id:s.id,name:s.name,pricePence:s.pricePence,durationMinutes:s.durationMinutes});
  }
  const ids=new Set(services.map(s=>s.id));
  const availability=[];
  for(const a of snapshot.availability){
   if(!a||!ids.has(a.serviceId)||typeof a.staffId!=="string"||
    !Array.isArray(a.times)||a.times.some(t=>typeof t!=="string"||
    !/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(t)))return deny;
   availability.push({serviceId:a.serviceId,staffId:a.staffId,times:a.times.slice()});
  }
  return {status:"READ_ONLY",bookingEnabled:false,businessName:snapshot.businessName,
   date:snapshot.date,services,availability};
 }
 async function load({slug,fetcher,now,origin}={}){
  if(!safeSlug(slug)||typeof fetcher!=="function"||
   origin!=="http://127.0.0.1:8080")return unavailable();
  const url=origin+"/v1/projects/"+PROJECT+"/databases/(default)/documents/"+
   COLLECTION+"/demo-owner";
  try{
   const response=await fetcher(url,{method:"GET",cache:"no-store",credentials:"omit"});
   if(!response.ok)return unavailable();
   const data=parseFirestore(await response.json());
   return view(data,{slug,now});
  }catch(_){return unavailable()}
 }
 return {view,load,parseFirestore,unavailable};
});
