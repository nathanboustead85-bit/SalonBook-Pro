"use strict";
// Phase 16.4: transaction-time double-booking safety rehearsal.
// This read-only adapter never acquires a lock or writes a reservation.
// Concurrent inspections can BOTH find a slot free; launch remains blocked.
const {checkExclusions}=require("./phase143BookingExclusions");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const ID=/^[A-Za-z0-9_-]{1,128}$/;
const deny=status=>Object.freeze({status,acceptingBookings:false,reservationCreated:false,
 reservationCreatedInTransaction:false});
function createTransactionSafetyPreparation(db,{loadSnapshot}={}){
 if(!db||typeof db.runTransaction!=="function"||typeof loadSnapshot!=="function")
  throw new TypeError("Firestore transaction and server snapshot reader required");
 async function inspect({ownerId,intent}={}){
  if(typeof ownerId!=="string"||!ID.test(ownerId))return deny("TRANSACTION_OWNER_INVALID");
  try{
   const result=await db.runTransaction(async tx=>{
    // loadSnapshot must use tx.get() for ALL relevant server-owned records.
    const snapshot=await loadSnapshot(tx,ownerId);
    if(!snapshot||snapshot.ownerId!==ownerId||snapshot.complete!==true
      ||snapshot.transactionRead!==true)return deny("TRANSACTION_SNAPSHOT_UNTRUSTED");
    const checked=checkExclusions(intent,snapshot.catalogue,
      snapshot.staffSchedules,snapshot.bookings);
    if(checked.status!=="NO_KNOWN_CONFLICTS_ONLY")return deny(checked.status);
    return deny("TRANSACTION_SLOT_INSPECTED_ONLY");
   },{maxAttempts:3,readOnly:true});
   return result&&result.acceptingBookings===false
    &&result.reservationCreated===false?result:deny("TRANSACTION_RESULT_UNTRUSTED");
  }catch{return deny("TRANSACTION_READ_FAILED");}
 }
 return Object.freeze({inspect,reserve:async()=>({...DISABLED}),
  requiresAtomicCommit:true,
  productionRequirements:Object.freeze([
   "Read all conflicts and idempotency marker in one Firestore transaction",
   "Create booking and request marker atomically in that same transaction",
   "Use a shared per-staff slot guard to prevent overlapping requests from both committing",
   "Retry conflicts and recover ambiguous commits by request marker",
   "Validate against live legacy appointments before enabling writes"
  ])});
}
module.exports=Object.freeze({createTransactionSafetyPreparation});
