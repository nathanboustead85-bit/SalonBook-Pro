"use strict";
const assert=require("node:assert/strict");
const {checkWorkingHours}=require("../functions/phase142WorkingHours");
const catalogue={services:[{id:"cut",published:true,durationMinutes:30}],staff:[{id:"kody",active:true,serviceIds:["cut"]}]};
const intent={serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"09:00"}; // Friday
const staff=[{id:"kody",weeklySchedule:{fri:{open:"09:00",close:"17:00"},mon:{open:"10:00",close:"16:00"}}}];
const cases=[
 ["opens exactly",intent,staff,"WITHIN_WORKING_HOURS_ONLY"],
 ["closes exactly",{...intent,time:"16:30"},staff,"WITHIN_WORKING_HOURS_ONLY"],
 ["before opening",{...intent,time:"08:59"},staff,"OUTSIDE_WORKING_HOURS"],
 ["after closing",{...intent,time:"16:31"},staff,"OUTSIDE_WORKING_HOURS"],
 ["closed Saturday",{...intent,date:"2026-11-21"},staff,"OUTSIDE_WORKING_HOURS"],
 ["Monday hours",{...intent,date:"2026-11-23",time:"10:00"},staff,"WITHIN_WORKING_HOURS_ONLY"],
 ["missing schedule",intent,[],"WORKING_HOURS_UNAVAILABLE"],
 ["missing weeklySchedule",intent,[{id:"kody"}],"WORKING_HOURS_UNAVAILABLE"],
 ["duplicate staff",intent,[...staff,...staff],"WORKING_HOURS_UNAVAILABLE"],
 ["invalid open",intent,[{id:"kody",weeklySchedule:{fri:{open:"9:00",close:"17:00"}}}],"WORKING_HOURS_UNAVAILABLE"],
 ["inverted hours",intent,[{id:"kody",weeklySchedule:{fri:{open:"17:00",close:"09:00"}}}],"WORKING_HOURS_UNAVAILABLE"],
 ["extra period field",intent,[{id:"kody",weeklySchedule:{fri:{open:"09:00",close:"17:00",unsafe:true}}}],"WORKING_HOURS_UNAVAILABLE"],
 ["invalid intent",{...intent,date:"2026-11-31"},staff,"INVALID_REQUEST"]
];
for(const [label,request,schedules,expected] of cases){
 const result=checkWorkingHours(request,catalogue,schedules);
 assert.equal(result.status,expected,label);
 assert.notEqual(result.acceptingBookings,true,label+" never enables bookings");
 console.log("PASS",label);
}
assert.equal(checkWorkingHours(intent,catalogue,staff).acceptingBookings,false);
console.log("PASS Phase 14.2 weekly schedule validation without writes or booking endpoints");
