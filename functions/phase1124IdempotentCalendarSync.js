"use strict";
/** Phase 11.24: synthetic, in-memory idempotent replay and atomic sync batches. Not deployed. */
const {guard}=require("./phase113DemoBookingEngine");
const {validateRequest,projectSnapshot}=require("./phase1115CloudCalendarContract");
const {createSafeCalendarRefresh}=require("./phase1120SafeCalendarRefresh");
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function createIdempotentCalendarSync({request,initial,revision=0}){
 guard();
 const valid=validateRequest(request);
 let current=projectSnapshot(valid,initial);
 if(!Number.isSafeInteger(revision)||revision<0)throw Error("invalid revision");
 let lastRevision=revision;
 function applyBatch(updates){
  guard();
  if(!Array.isArray(updates)||updates.length===0)throw Error("nonempty update batch required");
  // Stage all updates before committing any state; interruptions leave last good state.
  const staged=createSafeCalendarRefresh({request:valid,initial:current,revision:lastRevision});
  let applied=0,duplicates=0;
  for(const update of updates){
   if(!update||typeof update!=="object"||Array.isArray(update))throw Error("invalid update");
   const {revision:nextRevision,snapshot}=update;
   if(!Number.isSafeInteger(nextRevision)||nextRevision<0)throw Error("invalid revision");
   const candidate=projectSnapshot(valid,snapshot);
   if(nextRevision===staged.revision()){
    if(!equal(candidate,staged.snapshot()))throw Error("conflicting replay at same revision");
    duplicates++;continue;
   }
   if(nextRevision<staged.revision())throw Error("out-of-order calendar revision");
   staged.apply({revision:nextRevision,next:candidate});
   applied++;
  }
  current=staged.snapshot();lastRevision=staged.revision();
  return Object.freeze({applied,duplicates,revision:lastRevision,snapshot:current});
 }
 return Object.freeze({
  state(){guard();return Object.freeze({revision:lastRevision,snapshot:current});},
  applyBatch,
  apply(update){return applyBatch([update]);}
 });
}
module.exports={createIdempotentCalendarSync};
