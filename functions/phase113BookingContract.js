"use strict";
/** Phase 11.3 API contract ONLY; not a booking endpoint or implementation. */
const CONTRACT=Object.freeze({
 version:1,mode:"EMULATOR_ONLY_DESIGN",deployed:false,publicBookingsEnabled:false,
 projectId:"demo-boustio-legacy-init",
 endpoint:"createDemoBooking",
 method:"callable-prototype-not-exported",
 requestFields:Object.freeze(["businessId","serviceId","staffId","startAt","idempotencyKey","customerAccessToken"]),
 responseFields:Object.freeze(["bookingId","status","startAt","endAt","idempotentReplay"]),
 errors:Object.freeze(["UNAUTHENTICATED","PERMISSION_DENIED","INVALID_ARGUMENT","SLOT_UNAVAILABLE","DUPLICATE_REQUEST","RATE_LIMITED"]),
 invariants:Object.freeze([
  "Only synthetic demo business IDs and isolated emulator data",
  "Customer identity or booking-scoped access must be verified server-side",
  "Server computes service duration and endAt from trusted catalogue",
  "Server validates business and staff working hours, closures, breaks, time zone and DST",
  "Single atomic transaction protects slot allocation against concurrent requests",
  "Idempotency key scoped to customer and business prevents duplicate creation",
  "No reads or writes to production or legacy booking source",
  "No public endpoint until independent production review and explicit authorisation"
 ])
});
function validateContractShape(request){
 if(!request||typeof request!=="object"||Array.isArray(request))return false;
 if(Object.keys(request).some(k=>!CONTRACT.requestFields.includes(k)))return false;
 return CONTRACT.requestFields.every(k=>typeof request[k]==="string"&&request[k].length>0);
}
module.exports={CONTRACT,validateContractShape};
