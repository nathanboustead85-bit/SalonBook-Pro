"use strict";
const {locks}=require("./booking-lock-contract.cjs");
const {validateCatalogue}=require("./historical-booking/trustedCatalogue.js");
const {validateAvailability,validateBookingDate}=require("./historical-booking/bookingEngine.js");
function prepareReschedule(identity,d){
 return async(tx,{businessId,actorId,previous})=>{
 if(identity?.verified!==true||identity.uid!==actorId||actorId!==businessId||d.businessId!==businessId||d.action!=="reschedule")throw Error("Denied");
 if(previous)return {authorized:true};
 const current=await tx.readAppointment(businessId,d.appointmentId);
 if(!current||current.id!==d.appointmentId||current.businessId!==businessId||current.status!=="confirmed"||current.historical!==false||!Number.isSafeInteger(current.revision)||current.revision<1||current.revision!==d.expectedRevision)throw Error("Stale or invalid appointment");
 const catalogue=validateCatalogue(await tx.readCatalogue(businessId),businessId);
 const service=catalogue.services.find(s=>s.id===d.serviceId&&s.active),member=catalogue.staff.find(s=>s.id===d.staffId&&s.active&&s.serviceIds.includes(d.serviceId));
 if(!service||!member)throw Error("Unavailable");
 validateBookingDate(d.date,d.startTime);
 const {start,end}=validateAvailability(catalogue,service,member,d.date,d.startTime);
 return {authorized:true,available:true,revisionValid:true,appointmentId:current.id,oldLocks:locks(current.staffId,current.date,current.startMinute,current.endMinute),newLocks:locks(member.id,d.date,start,end),record:{...current,revision:current.revision+1,staffId:member.id,serviceId:service.id,date:d.date,startMinute:start,endMinute:end,price:service.price,durationMinutes:service.durationMinutes}};
 };
}
module.exports={prepareReschedule};