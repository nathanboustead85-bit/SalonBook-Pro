"use strict";
/** Phase 11.3 DESIGN CONTRACT ONLY: no database, network, or deployed functions. */
const PROJECT="demo-boustio-booking";
const OPERATIONS=Object.freeze(["quoteAvailability","createBooking","cancelBooking","rescheduleBooking"]);
const FIELDS=Object.freeze({
 quoteAvailability:Object.freeze(["businessId","serviceId","staffId","localDate"]),
 createBooking:Object.freeze(["businessId","serviceId","staffId","startAt","customerRef","idempotencyKey"]),
 cancelBooking:Object.freeze(["businessId","bookingId","customerProof","idempotencyKey"]),
 rescheduleBooking:Object.freeze(["businessId","bookingId","newStartAt","customerProof","idempotencyKey"])
});
const PROTECTED=Object.freeze(["users/{uid}/liveData/bookings","businesses/{businessId}/migrations/android-bookings-v1","businesses/{businessId}/settings/bookingMode"]);
const DESIGN=Object.freeze({
 status:"design-only",project:PROJECT,productionEnabled:false,customerBookingEnabled:false,
 timezone:"Europe/London",timeRepresentation:"UTC instants plus IANA zone",
 slotPolicy:"server-calculated; client slots are suggestions only",
 collisionPolicy:"transactionally reject overlap for staff and capacity; use canonical lock keys",
 idempotencyPolicy:"scope key to authenticated customer and business; persist result atomically",
 identityPolicy:"verified owner for management; scoped customer proof or verified account for customer mutations",
 paymentPolicy:"pay-in-salon first; no card data",
 retentionPolicy:"minimise personal data; retention and erasure policy required",
 bookingWrites:Object.freeze(["businesses/{businessId}/appointments/{appointmentId}","businesses/{businessId}/bookingLocks/{lockId}"]),
 prohibitedWrites:PROTECTED
});
function validateContract(operation,request){
 if(!OPERATIONS.includes(operation))throw Error("unknown booking operation");
 if(!request||typeof request!=="object"||Array.isArray(request))throw Error("invalid booking request");
 const allowed=FIELDS[operation];
 if(Object.keys(request).some(k=>!allowed.includes(k)))throw Error("unexpected booking field");
 if(allowed.some(k=>typeof request[k]!=="string"||request[k].length===0||request[k].length>256))throw Error("missing or invalid booking field");
 if(operation==="quoteAvailability"&&!/^\d{4}-\d{2}-\d{2}$/.test(request.localDate))throw Error("invalid local date");
 if(["createBooking","rescheduleBooking"].includes(operation)){
  const field=operation==="createBooking"?"startAt":"newStartAt";
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(request[field])||!Number.isFinite(Date.parse(request[field])))throw Error("UTC instant required");
 }
 return Object.freeze({valid:true,operation,productionEnabled:false});
}
module.exports={PROJECT,OPERATIONS,FIELDS,DESIGN,validateContract};
