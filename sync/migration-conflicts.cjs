"use strict";
const {validateRecords}=require("./migration-records.cjs");
const {locks}=require("../backend/booking-lock-contract.cjs");
// Normalized dry-run records only. No database writes.
function detectConflicts(raw,digest,businessId){
 const summary=validateRecords(raw,digest,businessId),data=JSON.parse(raw),occupied=new Map(),conflicts=new Set();
 for(const r of data.appointments){
 if(!["confirmed","cancelled","completed"].includes(r.status))throw Error("Invalid appointment status");
 if(r.status!=="confirmed")continue;
 for(const key of locks(r.staffId,r.date,r.startMinute,r.endMinute)){
 if(occupied.has(key)){conflicts.add(occupied.get(key));conflicts.add(r.id);}
 else occupied.set(key,r.id);
 }
 }
 return {...summary,conflictCount:conflicts.size,readyForReview:conflicts.size===0};
}
module.exports={detectConflicts};