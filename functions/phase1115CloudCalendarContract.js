"use strict";
/** Phase 11.15 cloud transport readiness contract. NO HTTP server, deployment or production exports. */
const {guard}=require("./phase113DemoBookingEngine");
const BUSINESS=/^demo_[A-Za-z0-9_-]{3,75}$/;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
function validateRequest(request){
 guard();
 if(!request||typeof request!=="object"||Array.isArray(request))throw Error("invalid request");
 if(Object.keys(request).sort().join(",")!=="businessId,date,ownerToken")throw Error("invalid request keys");
 const {businessId,date,ownerToken}=request;
 if(typeof businessId!=="string"||!BUSINESS.test(businessId))throw Error("synthetic business only");
 if(typeof date!=="string"||!DATE.test(date)||Number.isNaN(Date.parse(date+"T00:00:00Z"))||new Date(date+"T00:00:00Z").toISOString().slice(0,10)!==date)throw Error("invalid UK date");
 if(typeof ownerToken!=="string"||ownerToken.length<1||ownerToken.length>8192)throw Error("invalid owner token");
 return Object.freeze({businessId,date,ownerToken});
}
function projectSnapshot(request,snapshot){
 guard();
 if(!snapshot||snapshot.businessId!==request.businessId||snapshot.date!==request.date||!Array.isArray(snapshot.appointments))throw Error("invalid snapshot");
 const seen=new Set();
 const appointments=snapshot.appointments.map(item=>{
  if(!item||typeof item!=="object"||typeof item.id!=="string"||!item.id||seen.has(item.id)||item.source!=="demo_customer_web"||!["confirmed","cancelled"].includes(item.status))throw Error("invalid booking");
  if(typeof item.startAt!=="string"||typeof item.endAt!=="string"||!Number.isFinite(Date.parse(item.startAt))||!Number.isFinite(Date.parse(item.endAt))||Date.parse(item.endAt)<=Date.parse(item.startAt))throw Error("invalid appointment time");
  seen.add(item.id);
  return Object.freeze({id:item.id,source:item.source,serviceId:item.serviceId,staffId:item.staffId,startAt:item.startAt,endAt:item.endAt,status:item.status,localDate:request.date});
 });
 return Object.freeze({businessId:request.businessId,date:request.date,appointments:Object.freeze(appointments)});
}
function createCloudReadinessAdapter({snapshot,authorizeOwner}={}){
 guard();
 if(typeof snapshot!=="function"||typeof authorizeOwner!=="function")throw Error("trusted adapters required");
 return Object.freeze({async read(request){
  const validated=validateRequest(request);
  if(await authorizeOwner({businessId:validated.businessId,ownerToken:validated.ownerToken})!==true)throw Error("owner access denied");
  return projectSnapshot(validated,await snapshot(validated));
 }});
}
module.exports={validateRequest,projectSnapshot,createCloudReadinessAdapter};
