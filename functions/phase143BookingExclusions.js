"use strict";
// Phase 14.3: read-only local-wall-clock exclusion validation.
// Caller must provide a complete, trusted snapshot of relevant bookings.
// This does NOT reserve slots, read live Firestore or enable bookings.
const {checkWorkingHours}=require("./phase142WorkingHours");
const {minuteOfDay,validDate}=require("./phase141BookingIntent");
const DAYS=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
function validPeriod(p){
 if(!p||typeof p!=="object"||Array.isArray(p))return null;
 const start=minuteOfDay(p.start),end=minuteOfDay(p.end);
 return start!==null&&end!==null&&start<end?{start,end}:null;
}
function overlaps(a,b){return a.start<b.end&&b.start<a.end;}
function checkExclusions(intent,catalogue,staffSchedules,bookings){
 const base=checkWorkingHours(intent,catalogue,staffSchedules);
 if(base.status!=="WITHIN_WORKING_HOURS_ONLY")return base;
 const deny=status=>({status,acceptingBookings:false});
 if(!Array.isArray(bookings)||bookings.length>10000)return deny("BOOKINGS_UNAVAILABLE");
 const staff=staffSchedules.find(s=>s.id===base.staffId);
 if(!Array.isArray(staff.weeklyBreaks)||!Array.isArray(staff.timeOff)
   ||staff.weeklyBreaks.length>100||staff.timeOff.length>1000)return deny("EXCLUSIONS_UNAVAILABLE");
 const day=DAYS[new Date(base.date+"T12:00:00Z").getUTCDay()];
 const appointment={start:minuteOfDay(base.time),end:minuteOfDay(base.time)+base.durationMinutes};
 for(const item of staff.weeklyBreaks){
  if(!item||typeof item!=="object"||Array.isArray(item)||!DAYS.includes(item.day))return deny("EXCLUSIONS_UNAVAILABLE");
  const period=validPeriod(item);
  if(!period)return deny("EXCLUSIONS_UNAVAILABLE");
  if(item.day===day&&overlaps(appointment,period))return deny("STAFF_BREAK_CONFLICT");
 }
 for(const item of staff.timeOff){
  if(!item||typeof item!=="object"||Array.isArray(item)||!validDate(item.date))return deny("EXCLUSIONS_UNAVAILABLE");
  const period=validPeriod(item);
  if(!period)return deny("EXCLUSIONS_UNAVAILABLE");
  if(item.date===base.date&&overlaps(appointment,period))return deny("STAFF_TIME_OFF_CONFLICT");
 }
 for(const booking of bookings){
  if(!booking||typeof booking!=="object"||Array.isArray(booking)
    ||typeof booking.staffId!=="string"||!validDate(booking.date)
    ||typeof booking.status!=="string"||!["confirmed","cancelled"].includes(booking.status))
   return deny("BOOKINGS_UNAVAILABLE");
  if(booking.status==="cancelled")continue;
  const start=minuteOfDay(booking.time);
  if(start===null||!Number.isSafeInteger(booking.durationMinutes)
    ||booking.durationMinutes<1||start+booking.durationMinutes>1440)return deny("BOOKINGS_UNAVAILABLE");
  if(booking.staffId===base.staffId&&booking.date===base.date
    &&overlaps(appointment,{start,end:start+booking.durationMinutes}))
   return deny("EXISTING_BOOKING_CONFLICT");
 }
 return {...base,status:"NO_KNOWN_CONFLICTS_ONLY",acceptingBookings:false};
}
module.exports=Object.freeze({checkExclusions,overlaps,validPeriod});
