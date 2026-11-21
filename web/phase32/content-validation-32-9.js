"use strict";
// Phase 32.9: isolated, read-only business data integrity gate.
// No Firestore writes, storage, network calls, or live booking activation.
const MAX_JSON_CHARS=500000,MAX_RECORDS=500;
const unavailable=reason=>Object.freeze({status:"UNAVAILABLE",reason,bookingEnabled:false,services:Object.freeze([])});
const isObject=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const hasOnly=(v,keys)=>Object.keys(v).every(k=>keys.includes(k));
function validateService(s){
 if(!isObject(s)||!hasOnly(s,["id","name","pricePence","durationMinutes","active"]))return false;
 if(typeof s.id!=="string"||!/^[A-Za-z0-9_-]{1,64}$/.test(s.id))return false;
 if(typeof s.name!=="string"||s.name.trim().length<1||s.name.length>150)return false;
 if(!Number.isSafeInteger(s.pricePence)||s.pricePence<0||s.pricePence>10000000)return false;
 if(!Number.isInteger(s.durationMinutes)||s.durationMinutes<1||s.durationMinutes>480)return false;
 return typeof s.active==="boolean";
}
function validateServiceSnapshot(snapshot){
 if(!isObject(snapshot)||snapshot.schemaVersion!==1||typeof snapshot.json!=="string")return unavailable("invalid_envelope");
 if(snapshot.json.length>MAX_JSON_CHARS)return unavailable("oversized_payload");
 let parsed;
 try{parsed=JSON.parse(snapshot.json)}catch{return unavailable("malformed_json")}
 if(!Array.isArray(parsed)||parsed.length>MAX_RECORDS)return unavailable("invalid_service_collection");
 const ids=new Set(),clean=[];
 for(const service of parsed){
  if(!validateService(service))return unavailable("invalid_service");
  if(ids.has(service.id))return unavailable("duplicate_service_id");
  ids.add(service.id);
  clean.push(Object.freeze({...service}));
 }
 return Object.freeze({status:"VALIDATED_OFFLINE_PREVIEW",bookingEnabled:false,services:Object.freeze(clean)});
}
function recoverServiceSnapshot(primary,backup){
 const current=validateServiceSnapshot(primary);
 if(current.status==="VALIDATED_OFFLINE_PREVIEW")return Object.freeze({...current,source:"primary",recoveryNeeded:false});
 // Never auto-restore a backup to live data. Backup is read-only, validated independently.
 const candidate=validateServiceSnapshot(backup);
 if(candidate.status!=="VALIDATED_OFFLINE_PREVIEW")return Object.freeze({...unavailable("primary_and_backup_invalid"),recoveryNeeded:true});
 return Object.freeze({...candidate,status:"RECOVERY_PREVIEW_ONLY",source:"backup",recoveryNeeded:true,bookingEnabled:false});
}
module.exports=Object.freeze({validateServiceSnapshot,recoverServiceSnapshot,MAX_JSON_CHARS,MAX_RECORDS});
