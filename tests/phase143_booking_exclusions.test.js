"use strict";
const assert=require("node:assert/strict");
const {checkExclusions}=require("../functions/phase143BookingExclusions");
const catalogue={services:[{id:"cut",published:true,durationMinutes:30}],staff:[{id:"kody",active:true,serviceIds:["cut"]}]};
const intent={serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"09:00"};
const staff=[{id:"kody",weeklySchedule:{friday:{open:"09:00",close:"17:00"}},
 weeklyBreaks:[{day:"friday",start:"12:00",end:"12:30"}],
 timeOff:[{date:"2026-11-20",start:"15:00",end:"16:00"}]}];
const booking={staffId:"kody",date:"2026-11-20",time:"10:00",durationMinutes:30,status:"confirmed"};
const cases=[
 ["free",intent,staff,[booking],"NO_KNOWN_CONFLICTS_ONLY"],
 ["break",{...intent,time:"11:45"},staff,[],"STAFF_BREAK_CONFLICT"],
 ["break boundary",{...intent,time:"12:30"},staff,[],"NO_KNOWN_CONFLICTS_ONLY"],
 ["time off",{...intent,time:"14:45"},staff,[],"STAFF_TIME_OFF_CONFLICT"],
 ["time off boundary",{...intent,time:"16:00"},staff,[],"NO_KNOWN_CONFLICTS_ONLY"],
 ["booking overlap",{...intent,time:"09:45"},staff,[booking],"EXISTING_BOOKING_CONFLICT"],
 ["booking exact end",{...intent,time:"10:30"},staff,[booking],"NO_KNOWN_CONFLICTS_ONLY"],
 ["cancelled ignored",{...intent,time:"10:00"},staff,[{...booking,status:"cancelled"}],"NO_KNOWN_CONFLICTS_ONLY"],
 ["other staff ignored",{...intent,time:"10:00"},staff,[{...booking,staffId:"someoneElse"}],"NO_KNOWN_CONFLICTS_ONLY"],
 ["other day ignored",{...intent,time:"09:00"},staff,[{...booking,date:"2026-11-21"}],"NO_KNOWN_CONFLICTS_ONLY"],
 ["unknown bookings",intent,staff,null,"BOOKINGS_UNAVAILABLE"],
 ["malformed booking",intent,staff,[{...booking,time:"10am"}],"BOOKINGS_UNAVAILABLE"],
 ["unknown status",intent,staff,[{...booking,status:"pending"}],"BOOKINGS_UNAVAILABLE"],
 ["missing breaks",intent,[{...staff[0],weeklyBreaks:undefined}],[],"EXCLUSIONS_UNAVAILABLE"],
 ["invalid break",intent,[{...staff[0],weeklyBreaks:[{day:"friday",start:"12:00",end:"11:00"}]}],[],"EXCLUSIONS_UNAVAILABLE"],
 ["missing time off",intent,[{...staff[0],timeOff:undefined}],[],"EXCLUSIONS_UNAVAILABLE"],
 ["invalid time off",intent,[{...staff[0],timeOff:[{date:"2026-02-30",start:"10:00",end:"11:00"}]}],[],"EXCLUSIONS_UNAVAILABLE"],
 ["outside working hours",{...intent,time:"08:00"},staff,[],"OUTSIDE_WORKING_HOURS"]
];
for(const [label,input,schedules,bookings,expected] of cases){
 const result=checkExclusions(input,catalogue,schedules,bookings);
 assert.equal(result.status,expected,label);
 assert.notEqual(result.acceptingBookings,true,label+" booking stays disabled");
 console.log("PASS",label);
}
console.log("PASS Phase 14.3: no writes, no live bookings, fail-closed exclusions");
