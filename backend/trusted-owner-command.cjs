"use strict";
// Internal owner-only cancellation preparation. Identity must come from verified server context.
const {locks}=require("./booking-lock-contract.cjs");
function prepareCancellation(identity,command){
 return async(tx,{businessId,actorId})=>{
 if(identity?.verified!==true||identity.uid!==actorId||actorId!==businessId||command.action!=="cancel"||typeof command.appointmentId!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(command.appointmentId))throw Error("Denied");
 const current=await tx.readAppointment(businessId,command.appointmentId);
 if(!current||current.businessId!==businessId||current.id!==command.appointmentId||current.status!=="confirmed"||!Number.isSafeInteger(current.revision)||current.revision<1||current.historical!==false||current.revision!==command.expectedRevision)throw Error("Stale or invalid appointment");
 const oldLocks=locks(current.staffId,current.date,current.startMinute,current.endMinute);
 return {authorized:true,available:true,revisionValid:true,appointmentId:current.id,oldLocks,newLocks:[],record:{...current,status:"cancelled",revision:current.revision+1}};
 };
}
module.exports={prepareCancellation};
