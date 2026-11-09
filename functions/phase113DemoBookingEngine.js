"use strict";
/** Phase 11.3: isolated Firestore emulator booking prototype; NEVER export or deploy. */
const crypto=require("node:crypto");
const PROJECT="demo-boustio-legacy-init";
function deny(message){throw Error("phase113 "+message);}
function guard(){
 if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST||
 process.env.GCLOUD_PROJECT!==PROJECT||process.env.GOOGLE_CLOUD_PROJECT!==PROJECT||
 process.env.GOOGLE_APPLICATION_CREDENTIALS)deny("demo emulators required");
}
const validId=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{3,80}$/.test(x);
function createDemoBookingEngine({db,verifyCustomer}={}){
 guard();
 if(!db||typeof db.runTransaction!=="function"||typeof verifyCustomer!=="function")deny("trusted dependencies required");
 return Object.freeze({async book(request){
  guard();
  const keys=["businessId","serviceId","staffId","startAt","idempotencyKey","customerAccessToken"];
  if(!request||typeof request!=="object"||Array.isArray(request)||
   Object.keys(request).some(k=>!keys.includes(k))||keys.some(k=>typeof request[k]!=="string"||!request[k]))deny("invalid request");
  const {businessId,serviceId,staffId,startAt,idempotencyKey,customerAccessToken}=request;
  if(!businessId.startsWith("demo_")||![businessId,serviceId,staffId,idempotencyKey].every(validId)||
   idempotencyKey.length>80||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.000Z$/.test(startAt))deny("invalid request");
  const start=Date.parse(startAt);
  if(!Number.isFinite(start)||new Date(start).toISOString()!==startAt||start%60000!==0)deny("invalid start time");
  const customer=await verifyCustomer(customerAccessToken);
  if(!customer||!validId(customer.uid)||customer.verified!==true)deny("unauthenticated customer");
  const business=db.collection("phase113DemoBusinesses").doc(businessId);
  const service=business.collection("services").doc(serviceId);
  const staff=business.collection("staff").doc(staffId);
  const key=crypto.createHash("sha256").update(customer.uid+"\0"+idempotencyKey).digest("hex");
  const replay=business.collection("idempotency").doc(key);
  const bookingId=crypto.createHash("sha256").update(businessId+"\0"+key).digest("hex");
  const booking=business.collection("bookings").doc(bookingId);
  const fingerprint=crypto.createHash("sha256").update(JSON.stringify({businessId,serviceId,staffId,startAt})).digest("hex");
  return db.runTransaction(async tx=>{
   const [prior,srv,worker]=await Promise.all([tx.get(replay),tx.get(service),tx.get(staff)]);
   if(prior.exists){
    if(prior.get("fingerprint")!==fingerprint)deny("duplicate request conflict");
    return {...prior.get("result"),idempotentReplay:true};
   }
   if(!srv.exists||!worker.exists||srv.get("active")!==true||worker.get("active")!==true)deny("unavailable service or staff");
   const duration=srv.get("durationMinutes");
   if(!Number.isInteger(duration)||duration<5||duration>480)deny("invalid duration");
   const end=start+duration*60000;
   // Demo policy: UTC business hours, 09:00–17:00, no DST conversion claimed.
   const day=new Date(start).getUTCDay();
   const startMinute=new Date(start).getUTCHours()*60+new Date(start).getUTCMinutes();
   const endMinute=startMinute+duration;
   if(day===0||day===6||startMinute<540||endMinute>1020)deny("outside demo working hours");
   if(!Array.isArray(worker.get("serviceIds"))||!worker.get("serviceIds").includes(serviceId))deny("staff not qualified");
   // One transactionally read/written staff-day allocation document serialises all overlapping bookings.
   const dayId=startAt.slice(0,10);
   const calendar=business.collection("staffDays").doc(staffId+"_"+dayId);
   const calendarSnap=await tx.get(calendar);
   const slots=calendarSnap.exists?calendarSnap.get("slots")||[]:[];
   if(!Array.isArray(slots)||slots.some(s=>!Number.isFinite(s.start)||!Number.isFinite(s.end)))deny("invalid calendar");
   if(slots.some(s=>start<s.end&&end>s.start))deny("slot unavailable");
   const result={bookingId,status:"confirmed",startAt,endAt:new Date(end).toISOString(),idempotentReplay:false};
   tx.set(calendar,{slots:[...slots,{start,end,bookingId}]});
   tx.create(booking,{customerUid:customer.uid,serviceId,staffId,startAt,endAt:result.endAt,status:"confirmed",schemaVersion:1});
   tx.create(replay,{fingerprint,result,customerUid:customer.uid});
   return result;
  });
 }});
}
module.exports={createDemoBookingEngine,guard};
