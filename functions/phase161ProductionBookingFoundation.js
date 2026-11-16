"use strict";
// Phase 16.1: server-only production booking architecture foundation.
// No Firebase endpoint, no database writes, no reservations. Explicitly disabled.
const {prepareBookingStoragePlan}=require("./phase151BookingInfrastructurePreparation");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const {assessReleaseReadiness}=require("./phase1415ReleaseReadiness");
const OWNER=/^[A-Za-z0-9_-]{1,128}$/;
const deny=status=>Object.freeze({status,acceptingBookings:false,reservationCreated:false});
const REQUIRED=Object.freeze(["authenticated_owner_scope","server_validated_intent",
 "server_snapshot_availability","atomic_reservation_and_marker","durable_idempotency_recovery",
 "firestore_rules_and_abuse_protection","multi_device_production_validation"]);
function createProductionBookingFoundation({trustedContext,secret}={}){
 // A caller-provided flag is NOT authentication: only a server-owned verifier may
 // supply the trusted principal. This module does not expose any public handler.
 function inspect(input){
  if(!trustedContext||typeof trustedContext.resolveOwner!=="function")
   return deny("PRODUCTION_CONTEXT_UNAVAILABLE");
  let principal;
  try{principal=trustedContext.resolveOwner();}catch{return deny("PRODUCTION_CONTEXT_UNAVAILABLE");}
  if(!principal||principal.serverVerified!==true||principal.emailVerified!==true
   ||typeof principal.ownerId!=="string"||!OWNER.test(principal.ownerId))
   return deny("PRODUCTION_OWNER_UNVERIFIED");
  if(!input||input.ownerId!==principal.ownerId)return deny("PRODUCTION_OWNER_MISMATCH");
  const plan=prepareBookingStoragePlan({...input,secret});
  if(plan.status!=="BOOKING_STORAGE_PLAN_ONLY")return deny("PRODUCTION_PLAN_INVALID");
  // Only opaque storage paths are exposed; no customer details or raw idempotency key.
  return Object.freeze({status:"PRODUCTION_ARCHITECTURE_ONLY",
   acceptingBookings:false,reservationCreated:false,
   bookingCollectionPath:plan.bookingCollectionPath,
   recoveryDocumentPath:plan.recoveryDocumentPath,
   atomicityRequirement:plan.atomicityRequirement,
   requiredControls:REQUIRED.slice()});
 }
 return Object.freeze({inspect,reserve:async()=>({...DISABLED}),
  readiness:()=>Object.freeze({readyForLiveCustomerBookings:false,
   acceptingBookings:false,requiredControls:REQUIRED.slice(),
   launchBlockers:assessReleaseReadiness().gates.map(g=>g.id)})});
}
module.exports=Object.freeze({createProductionBookingFoundation,REQUIRED});
