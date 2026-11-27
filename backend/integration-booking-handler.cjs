"use strict";
const {authenticate}=require("./integration-auth.cjs");
const {prepareRequest}=require("../sync/android-request.cjs");
const {executeBooking}=require("./booking-transaction.cjs");
const {prepareCreation}=require("./trusted-owner-create.cjs");
const {prepareCancellation}=require("./trusted-owner-command.cjs");
const {prepareCustomerCreation}=require("./trusted-customer-create.cjs");
const {createHash}=require("node:crypto");
// Isolated handler only; no production listener or deployment.
function createHandler({db,auth,serverTimestamp}){
 const {createStore}=require("./firestore-booking-store.cjs");
 if(!/^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST||"")||auth?.app?.options?.projectId!=="demo-boustio")throw Error("Isolated auth emulator required");
 const store=createStore(db,serverTimestamp);
 return async(authorization,body)=>{
 const identity=await authenticate(authorization,auth.verifyIdToken.bind(auth));
 if(!body||typeof body!=="object"||Array.isArray(body))throw Error("Invalid request");
 const d=prepareRequest({verified:true,uid:identity.uid,businessId:body.businessId},body,body.requestId);
 let prepare;
 if(d.action==="create")prepare=identity.uid===d.businessId?prepareCreation(identity,d):prepareCustomerCreation(identity,d);
 else if(d.action==="cancel"&&identity.uid===d.businessId)prepare=prepareCancellation(identity,d);
 else throw Error("Denied");
 return executeBooking({store,businessId:d.businessId,actorId:identity.uid,key:d.requestId,receiptVersion:1,fingerprint:createHash("sha256").update(JSON.stringify(d)).digest("hex"),prepare});
 };
}
module.exports={createHandler};
