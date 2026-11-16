"use strict";
const assert=require("node:assert/strict");
const {validDate,minuteOfDay,validateBookingIntent}=require("../functions/phase141BookingIntent");
const catalogue={services:[{id:"cut",published:true,durationMinutes:30},{id:"hidden",published:false,durationMinutes:30}],
 staff:[{id:"kody",active:true,serviceIds:["cut"]},{id:"inactive",active:false,serviceIds:["cut"]},{id:"other",active:true,serviceIds:["hidden"]}]};
const good={serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"09:30"};
const cases=[
 ["valid intent",good,"VALIDATED_INTENT_ONLY"],
 ["bad object",null,"INVALID_REQUEST"],
 ["unexpected fields",{...good,customerName:"Private"},"INVALID_REQUEST"],
 ["missing field",{...good,time:undefined},"INVALID_REQUEST"],
 ["invalid leap date",{...good,date:"2026-02-29"},"INVALID_REQUEST"],
 ["valid leap date",{...good,date:"2028-02-29"},"VALIDATED_INTENT_ONLY"],
 ["invalid time",{...good,time:"24:00"},"INVALID_REQUEST"],
 ["invalid time minute",{...good,time:"09:60"},"INVALID_REQUEST"],
 ["overnight",{...good,time:"23:45"},"INVALID_REQUEST"],
 ["unpublished service",{...good,serviceId:"hidden"},"SELECTION_UNAVAILABLE"],
 ["inactive staff",{...good,staffId:"inactive"},"SELECTION_UNAVAILABLE"],
 ["incompatible staff",{...good,staffId:"other"},"SELECTION_UNAVAILABLE"],
 ["unknown staff",{...good,staffId:"missing"},"SELECTION_UNAVAILABLE"],
 ["invalid id",{...good,staffId:"../owner"},"INVALID_REQUEST"]
];
for(const [label,input,status] of cases){
 const result=validateBookingIntent(input,catalogue);
 assert.equal(result.status,status,label);
 assert.equal(result.acceptingBookings===true,false,label+" never enables bookings");
 console.log("PASS",label);
}
assert.equal(validDate("2026-11-31"),false);
assert.equal(validDate("2028-02-29"),true);
assert.equal(minuteOfDay("09:30"),570);
assert.equal(minuteOfDay("9:30"),null);
assert.equal(validateBookingIntent(good,null).status,"CATALOGUE_UNAVAILABLE");
assert.equal(validateBookingIntent(good,{services:[{id:"cut",published:true,durationMinutes:999}],staff:catalogue.staff}).status,"CATALOGUE_UNAVAILABLE");
assert.equal(validateBookingIntent(good,catalogue).acceptingBookings,false);
console.log("PASS Phase 14.1 booking-intent validation; no writes or booking endpoints");
