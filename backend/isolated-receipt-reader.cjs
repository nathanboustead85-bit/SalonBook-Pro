"use strict";
const {authenticate}=require("./integration-auth.cjs");
const {requestKey}=require("./booking-lock-contract.cjs");
const valid=v=>typeof v==="string"&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
function createReceiptReader({db,auth}){
 if(!/^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST||"")||!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||"")||db?.projectId!=="demo-boustio"||auth?.app?.options?.projectId!=="demo-boustio")throw Error("Isolated emulators required");
 return async(authorization,body)=>{
 const {uid}=await authenticate(authorization,auth.verifyIdToken.bind(auth));
 if(!body||!valid(body.businessId)||!valid(body.requestId)||body.businessId!==uid)throw Error("Denied");
 const snapshot=await db.collection("businesses").doc(uid).collection("bookingRequests").doc(requestKey(uid,uid,body.requestId)).get();
 const r=snapshot.exists?snapshot.data()?.result:null;
 if(!r||r.receiptVersion!==1||r.accepted!==true||r.status!=="accepted"||r.businessId!==uid||r.actorId!==uid||r.requestId!==body.requestId||!valid(r.appointmentId)||!Number.isSafeInteger(r.revision)||r.revision<1)throw Error("Unavailable");
 return {receiptVersion:1,accepted:true,status:"accepted",businessId:uid,actorId:uid,requestId:r.requestId,appointmentId:r.appointmentId,revision:r.revision};
 };
}
module.exports={createReceiptReader};
