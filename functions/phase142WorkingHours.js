"use strict";
// Phase 14.2: pure weekly-hours eligibility using Android staff.weeklySchedule.
// Does not read live cloud data, handle breaks/time off, reserve slots or enable booking.
const {validateBookingIntent,minuteOfDay}=require("./phase141BookingIntent");
const DAYS=["sun","mon","tue","wed","thu","fri","sat"];
function checkWorkingHours(intent,catalogue,staffSchedules){
 const validated=validateBookingIntent(intent,catalogue);
 if(validated.status!=="VALIDATED_INTENT_ONLY")return validated;
 if(!Array.isArray(staffSchedules)||staffSchedules.length>50)return {status:"WORKING_HOURS_UNAVAILABLE",acceptingBookings:false};
 const matching=staffSchedules.filter(s=>s&&s.id===validated.staffId);
 if(matching.length!==1)return {status:"WORKING_HOURS_UNAVAILABLE",acceptingBookings:false};
 const schedule=matching[0].weeklySchedule;
 if(!schedule||typeof schedule!=="object"||Array.isArray(schedule))return {status:"WORKING_HOURS_UNAVAILABLE",acceptingBookings:false};
 const day=DAYS[new Date(validated.date+"T12:00:00Z").getUTCDay()];
 const period=schedule[day];
 if(period===undefined)return {status:"OUTSIDE_WORKING_HOURS",acceptingBookings:false};
 if(!period||typeof period!=="object"||Array.isArray(period)
   ||Object.keys(period).length!==2||!Object.hasOwn(period,"open")||!Object.hasOwn(period,"close"))
  return {status:"WORKING_HOURS_UNAVAILABLE",acceptingBookings:false};
 const open=minuteOfDay(period.open),close=minuteOfDay(period.close);
 if(open===null||close===null||open>=close)return {status:"WORKING_HOURS_UNAVAILABLE",acceptingBookings:false};
 const start=minuteOfDay(validated.time);
 if(start<open||start+validated.durationMinutes>close)
  return {status:"OUTSIDE_WORKING_HOURS",acceptingBookings:false};
 return {...validated,status:"WITHIN_WORKING_HOURS_ONLY",acceptingBookings:false};
}
module.exports=Object.freeze({checkWorkingHours});
