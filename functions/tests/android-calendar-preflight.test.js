"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { preflightAndroidCalendar } = require("../androidCalendarPreflight");
const booking = {id:"booking1",staffId:"alex",serviceId:"cut",date:"2026-11-18",
  time:"10:00",duration:30,client:"Customer",service:"Cut",price:"20"};
function run(records=[booking], existingAppointments=[], existingLocks=[]) {
  return preflightAndroidCalendar({businessId:"owner1",bookingsJson:JSON.stringify(records),
    existingAppointments,existingLocks});
}
test("valid Android booking yields read-only preflight with two locks",()=>{
  const result=run();
  assert.equal(result.safeToProceed,true);
  assert.equal(result.proposedLockCount,2);
  assert.equal(result.sourceHash.length,64);
  assert.match(result.warning,/READ-ONLY/);
});
test("empty source cannot certify migration",()=>{
  const result=run([]);
  assert.equal(result.safeToProceed,false);
});
test("missing staff blocks migration",()=>{
  const result=run([{...booking,staffId:""}]);
  assert.equal(result.safeToProceed,false);
});
test("overlapping Android bookings block migration",()=>{
  const result=run([booking,{...booking,id:"booking2",time:"10:15"}]);
  assert.equal(result.safeToProceed,false);
});
test("existing occupied lock blocks migration",()=>{
  const result=run([booking],[],[{lockId:"alex_2026-11-18_1000",appointmentId:"other"}]);
  assert.equal(result.safeToProceed,false);
});
test("duplicate appointment ID on server blocks migration",()=>{
  const existing={id:"booking1",staffId:"alex",date:"2026-11-18",
    startTime:"09:00",endTime:"09:30",status:"confirmed"};
  const locks=["0900","0915"].map(t=>({lockId:"alex_2026-11-18_"+t,appointmentId:"booking1"}));
  const result=run([booking],[existing],locks);
  assert.equal(result.safeToProceed,false);
});
test("unreconciled server appointment blocks migration",()=>{
  const existing={id:"old",staffId:"alex",date:"2026-11-18",
    startTime:"09:00",endTime:"09:30",status:"confirmed"};
  const result=run([booking],[existing],[]);
  assert.equal(result.safeToProceed,false);
  assert.equal(result.existingAudit.reconciled,false);
});
