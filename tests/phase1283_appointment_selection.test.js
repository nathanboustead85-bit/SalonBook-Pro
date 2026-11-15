"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {validDate,prepareAppointmentPreview}=require("../web/phase1283/appointmentSelection");
const payload=()=>({schemaVersion:1,slug:"demo-salon",published:true,businessName:"Demo Salon",
 services:[{id:"cut",name:"Haircut",pricePence:2000,durationMinutes:30,published:true}],
 staff:[{id:"sam",name:"Sam",active:true,serviceIds:["cut"]}],clients:[{email:"secret@example.com"}],ownerUid:"private"});
const slots=()=>[{date:"2026-11-20",time:"10:00",staffId:"sam",serviceId:"cut",available:true},
 {date:"2026-11-20",time:"11:00",staffId:"sam",serviceId:"cut",available:false}];
const run=(date="2026-11-20",time="10:00",list=slots(),staff="sam")=>
 prepareAppointmentPreview(payload(),"demo-salon","cut",staff,date,time,list);
const ready=run();
assert.equal(ready.status,"APPOINTMENT_PREVIEW_READY");
assert.equal(ready.bookingEnabled,false);
assert.equal(ready.appointment.date,"2026-11-20");
assert.equal(ready.appointment.time,"10:00");
assert.equal(ready.appointment.staff.name,"Sam");
assert.ok(Object.isFrozen(ready.appointment));
assert.equal("clients" in ready.appointment,false);
assert.equal("ownerUid" in ready.appointment,false);
for(const d of ["2026-02-30","2026-13-01","2026-11-31","2026-1-2","../private",""])assert.equal(validDate(d),false);
assert.equal(validDate("2028-02-29"),true);
assert.equal(validDate("2027-02-29"),false);
for(const [date,time,list,staff] of [
 ["2026-11-20","11:00",slots(),"sam"],
 ["2026-11-20","12:00",slots(),"sam"],
 ["2026-11-21","10:00",slots(),"sam"],
 ["2026-11-20","25:00",slots(),"sam"],
 ["2026-02-30","10:00",slots(),"sam"],
 ["2026-11-20","10:00",null,"sam"],
 ["2026-11-20","10:00",[...slots(),slots()[0]],"sam"],
 ["2026-11-20","10:00",slots(),"unknown"]
])assert.equal(run(date,time,list,staff).status,"APPOINTMENT_PREVIEW_UNAVAILABLE");
assert.equal(prepareAppointmentPreview({...payload(),published:false},"demo-salon","cut","sam","2026-11-20","10:00",slots()).bookingEnabled,false);
const source=fs.readFileSync("web/phase1283/appointmentSelection.js","utf8");
for(const forbidden of ["fetch(","XMLHttpRequest","localStorage","sessionStorage","indexedDB","firebase.","WebSocket("])assert.ok(!source.includes(forbidden),forbidden);
console.log("PASS Phase 12.83 fictional date and time selection safety");
