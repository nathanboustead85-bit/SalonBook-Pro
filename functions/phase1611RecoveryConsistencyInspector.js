"use strict";
// Phase 16.11: strict, fail-closed consistency checks for injected recovery pairs.
// This is read-only preparation. A trusted Firestore adapter must establish
// consistent reads; a fixture flag is NOT evidence of live transaction safety.
const {timingSafeEqual}=require("node:crypto");
const {prepareBookingStoragePlan}=require("./phase151BookingInfrastructurePreparation");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const HEX=/^[a-f0-9]{64}$/;
const deny=status=>Object.freeze({status,acceptingBookings:false,reservationCreated:false});
function equal(a,b){return typeof a==="string"&&typeof b==="string"&&HEX.test(a)&&HEX.test(b)
 &&timingSafeEqual(Buffer.from(a,"hex"),Buffer.from(b,"hex"));}
function exact(obj,keys){return obj&&typeof obj==="object"&&!Array.isArray(obj)
 &&Object.keys(obj).length===keys.length&&keys.every(k=>Object.hasOwn(obj,k));}
const MARKER=["ownerId","requestId","fingerprint","reservationId","state","schemaVersion"];
const RESERVATION=["id","ownerId","requestId","fingerprint","state","schemaVersion"];
function createRecoveryConsistencyInspector({secret,readConsistentPair}={}){
 if(typeof readConsistentPair!=="function")throw new TypeError("Trusted read provider required");
 async function inspect(input){
  const plan=prepareBookingStoragePlan({...input,secret});
  if(plan.status!=="BOOKING_STORAGE_PLAN_ONLY")return deny("CONSISTENCY_REQUEST_INVALID");
  let pair;
  try{pair=await readConsistentPair({ownerId:plan.ownerId,requestId:plan.requestId,
   recoveryDocumentPath:plan.recoveryDocumentPath,
   bookingCollectionPath:plan.bookingCollectionPath});}
  catch{return deny("CONSISTENCY_READ_UNAVAILABLE");}
  if(!pair||pair.consistentSnapshot!==true)return deny("CONSISTENCY_SNAPSHOT_UNTRUSTED");
  if(!pair.marker&&!pair.reservation)return deny("CONSISTENCY_NO_RECORD_ONLY");
  if(!pair.marker||!pair.reservation)return deny("CONSISTENCY_PARTIAL_RECORD_MANUAL_REVIEW");
  const m=pair.marker,r=pair.reservation;
  if(!exact(m,MARKER)||!exact(r,RESERVATION)
   ||m.schemaVersion!==1||r.schemaVersion!==1
   ||typeof m.ownerId!=="string"||!m.ownerId
   ||typeof r.ownerId!=="string"||!r.ownerId
   ||!HEX.test(m.requestId??"")||!HEX.test(r.requestId??"")
   ||!HEX.test(m.fingerprint??"")||!HEX.test(r.fingerprint??"")
   ||!HEX.test(m.reservationId??"")||!HEX.test(r.id??"")
   ||typeof m.state!=="string"||typeof r.state!=="string")
   return deny("CONSISTENCY_SCHEMA_INVALID");
  if(!equal(m.fingerprint,plan.fingerprint))
   return deny("CONSISTENCY_IDEMPOTENCY_KEY_REUSED");
  if(m.ownerId!==plan.ownerId||r.ownerId!==plan.ownerId
   ||!equal(m.requestId,plan.requestId)||!equal(r.requestId,plan.requestId)
   ||!equal(r.fingerprint,plan.fingerprint)
   ||!equal(m.reservationId,r.id)
   ||m.state!=="COMMITTED_SIMULATION"||r.state!=="COMMITTED_SIMULATION")
   return deny("CONSISTENCY_CORRUPT_MANUAL_REVIEW");
  return deny("CONSISTENCY_PRIOR_SIMULATED_COMMIT_VERIFIED");
 }
 return Object.freeze({inspect,reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createRecoveryConsistencyInspector});
