"use strict";
const {locks}=require("./booking-lock-contract.cjs");
const {validateCatalogue}=require("./historical-booking/trustedCatalogue.js");
const {validateAvailability,validateBookingDate}=require("./historical-booking/bookingEngine.js");
const {authorizeCustomer}=require("./customer-authorization.cjs");
function prepareCustomerCreation(identity,command){
 return async(tx,{businessId,actorId,previous})=>{
 if(identity?.uid!==actorId||command.businessId!==businessId)throw Error("Denied");
 const raw=await tx.readCatalogue(businessId);
 if(!authorizeCustomer(identity,command,raw?.business))throw Error("Denied");
 if(previous)return {authorized:true};
 const id=command.appointmentId;
 if(typeof id!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(id)||await tx.readAppointment(businessId,id))throw Error("Invalid or existing appointment");
 const catalogue=validateCatalogue(raw,businessId);
 const service=catalogue.services.find(s=>s.id===command.serviceId&&s.active);
 const member=catalogue.staff.find(s=>s.id===command.staffId&&s.active&&s.serviceIds.includes(command.serviceId));
 if(!service||!member)throw Error("Unavailable");
 validateBookingDate(command.date,command.startTime);
 const {start,end}=validateAvailability(catalogue,service,member,command.date,command.startTime);
 return {authorized:true,available:true,revisionValid:true,appointmentId:id,oldLocks:[],newLocks:locks(member.id,command.date,start,end),record:{id,businessId,customerUid:actorId,status:"confirmed",historical:false,revision:1,staffId:member.id,serviceId:service.id,date:command.date,startMinute:start,endMinute:end,price:service.price,durationMinutes:service.durationMinutes}};
 };
}
module.exports={prepareCustomerCreation};
