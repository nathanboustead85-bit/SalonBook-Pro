"use strict";
/**
 * Boustio Phase 14.1 — server-side booking request validation foundation.
 * Pure validation only: no endpoint, writes, availability claims or live bookings.
 * Times are local wall-clock values; later phases must resolve timezone and
 * perform authoritative working-hours and collision checks transactionally.
 */
const ID=/^[A-Za-z0-9_-]{1,128}$/;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const TIME=/^([01]\d|2[0-3]):([0-5]\d)$/;
function validDate(value){
 if(typeof value!=="string"||!DATE.test(value))return false;
 const [y,m,d]=value.split("-").map(Number);
 if(y<2026||y>2100)return false;
 const dt=new Date(Date.UTC(y,m-1,d));
 return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d;
}
function minuteOfDay(value){
 if(typeof value!=="string"||!TIME.test(value))return null;
 const [h,m]=value.split(":").map(Number);
 return h*60+m;
}
function validateBookingIntent(input,catalogue){
 if(!input||typeof input!=="object"||Array.isArray(input))return {status:"INVALID_REQUEST"};
 const keys=Object.keys(input);
 if(keys.length!==4||!["serviceId","staffId","date","time"].every(k=>Object.hasOwn(input,k)))
  return {status:"INVALID_REQUEST"};
 const {serviceId,staffId,date,time}=input;
 if(typeof serviceId!=="string"||!ID.test(serviceId)||typeof staffId!=="string"||!ID.test(staffId)
  ||!validDate(date)||minuteOfDay(time)===null)return {status:"INVALID_REQUEST"};
 if(!catalogue||!Array.isArray(catalogue.services)||!Array.isArray(catalogue.staff))
  return {status:"CATALOGUE_UNAVAILABLE"};
 const service=catalogue.services.find(s=>s&&s.id===serviceId&&s.published===true);
 const staff=catalogue.staff.find(s=>s&&s.id===staffId&&s.active===true);
 if(!service||!staff||!Array.isArray(staff.serviceIds)||!staff.serviceIds.includes(serviceId))
  return {status:"SELECTION_UNAVAILABLE"};
 if(!Number.isSafeInteger(service.durationMinutes)||service.durationMinutes<5||service.durationMinutes>480)
  return {status:"CATALOGUE_UNAVAILABLE"};
 const startMinute=minuteOfDay(time);
 if(startMinute+service.durationMinutes>1440)return {status:"INVALID_REQUEST"};
 return {status:"VALIDATED_INTENT_ONLY",serviceId,staffId,date,time,durationMinutes:service.durationMinutes,
  acceptingBookings:false};
}
module.exports=Object.freeze({validDate,minuteOfDay,validateBookingIntent});
