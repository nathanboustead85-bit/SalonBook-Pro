"use strict";
/** Phase 11.20: isolated, non-destructive calendar refresh state. Never deployed. */
const {guard}=require("./phase113DemoBookingEngine");
const {validateRequest,projectSnapshot}=require("./phase1115CloudCalendarContract");
const {reconcileCalendar}=require("./phase1119CalendarReconciliation");
function createSafeCalendarRefresh({request,initial,revision=0}){
 guard();
 const validated=validateRequest(request);
 if(!Number.isSafeInteger(revision)||revision<0)throw Error("invalid revision");
 let current=projectSnapshot(validated,initial);
 let lastRevision=revision;
 return Object.freeze({
  snapshot(){guard();return current;},
  revision(){guard();return lastRevision;},
  apply({next,revision:incoming}){
   guard();
   if(!Number.isSafeInteger(incoming)||incoming<=lastRevision)throw Error("stale calendar revision");
   const candidate=projectSnapshot(validated,next);
   const changes=reconcileCalendar({request:validated,previous:current,current:candidate});
   // An omitted booking is not proof of cancellation; preserve the previous state.
   if(changes.removed.length)throw Error("incomplete calendar feed: existing bookings missing");
   // A cancelled booking must remain represented with explicit cancelled status.
   current=candidate;
   lastRevision=incoming;
   return changes;
  }
 });
}
module.exports={createSafeCalendarRefresh};
