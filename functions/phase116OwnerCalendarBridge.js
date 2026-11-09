"use strict";
/** Phase 11.6 emulator-only owner calendar feed. Not a production endpoint. */
const {guard}=require("./phase113DemoBookingEngine");
const {localDay}=require("./phase114UkSchedule");
const ID=/^demo_[A-Za-z0-9_-]{3,75}$/;
function validateBusiness(id){guard();if(typeof id!=="string"||!ID.test(id))throw Error("synthetic business required");}
function toCalendarItem(doc){
 const b=doc.data(),start=Date.parse(b.startAt),end=Date.parse(b.endAt);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||!["confirmed","cancelled"].includes(b.status))throw Error("invalid booking data");
 return Object.freeze({id:doc.id,source:"demo_customer_web",serviceId:b.serviceId,staffId:b.staffId,startAt:b.startAt,endAt:b.endAt,status:b.status,localDate:localDay(start)});
}
function createOwnerCalendarBridge({db,authorizeOwner}={}){
 guard();
 if(!db||typeof authorizeOwner!=="function")throw Error("trusted dependencies required");
 function collection(businessId){validateBusiness(businessId);return db.collection("phase113DemoBusinesses").doc(businessId).collection("bookings");}
 async function permission(businessId,ownerToken){guard();if(typeof ownerToken!=="string"||!ownerToken)throw Error("owner token required");const ok=await authorizeOwner({businessId,ownerToken});if(ok!==true)throw Error("owner access denied");}
 return Object.freeze({
  async snapshot({businessId,ownerToken,date}){
   await permission(businessId,ownerToken);
   if(typeof date!=="string"||!/^\d{4}-\d\d-\d\d$/.test(date)||new Date(date+"T00:00:00.000Z").toISOString().slice(0,10)!==date)throw Error("invalid local date");
   const snap=await collection(businessId).get();
   const items=snap.docs.map(toCalendarItem).filter(b=>b.localDate===date).sort((a,b)=>a.startAt.localeCompare(b.startAt)||a.id.localeCompare(b.id));
   return {businessId,date,appointments:items};
  },
  async subscribe({businessId,ownerToken,date,onChange,onError}){
   await permission(businessId,ownerToken);
   if(typeof onChange!=="function"||typeof onError!=="function")throw Error("callbacks required");
   if(typeof date!=="string"||!/^\d{4}-\d\d-\d\d$/.test(date)||new Date(date+"T00:00:00.000Z").toISOString().slice(0,10)!==date)throw Error("invalid local date");
   return collection(businessId).onSnapshot(snap=>{
    try{const appointments=snap.docs.map(toCalendarItem).filter(b=>b.localDate===date).sort((a,b)=>a.startAt.localeCompare(b.startAt)||a.id.localeCompare(b.id));onChange({businessId,date,appointments});}catch(e){onError(e);}
   },onError);
  }
 });
}
module.exports={createOwnerCalendarBridge};
