"use strict";
// Emulator-only adapter. Do not use for live data.
function createStore(db,serverTimestamp){
 if(!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||"")||!db||db.projectId!=="demo-boustio"||typeof serverTimestamp!=="function")throw Error("Isolated emulator required");
 const ref=(b,c,k)=>{if(![b,k].every(x=>typeof x==="string"&&/^[A-Za-z0-9_-]{1,180}$/.test(x)))throw Error("Invalid path");return db.collection("businesses").doc(b).collection(c).doc(k);};
 return {runTransaction:fn=>db.runTransaction(async t=>{
 const read=async(b,c,k)=>{const s=await t.get(ref(b,c,k));return s.exists?s.data():null;};
 return fn({
 readRequest:(b,k)=>read(b,"bookingRequests",k),
 readLock:async(b,k)=>{const v=await read(b,"bookingLocks",k);if(!v)return null;if(typeof v.appointmentId!=="string"||v.businessId!==b)throw Error("Invalid lock record");return v.appointmentId;},
 readAppointment:(b,k)=>read(b,"appointments",k),
 readCatalogue:b=>read(b,"catalogue","current"),
 releaseLock:(b,k)=>t.delete(ref(b,"bookingLocks",k)),
 acquireLock:(b,k,v)=>t.create(ref(b,"bookingLocks",k),{appointmentId:v,businessId:b,createdAt:serverTimestamp()}),
 writeAppointment:(b,k,v)=>t.set(ref(b,"appointments",k),{...v,businessId:b,updatedAt:serverTimestamp()}),
 writeRequest:(b,k,v)=>t.create(ref(b,"bookingRequests",k),{...v,createdAt:serverTimestamp()})
 });
 })};
}
module.exports={createStore};
