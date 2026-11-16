"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {assessReleaseReadiness,reserve,GATES}=require("../functions/phase1415ReleaseReadiness");
const {DISABLED,createDisabledAtomicReservation}=require("../functions/phase147DisabledAtomicReservation");
const {createEndToEndSafetyRehearsal}=require("../functions/phase1414EndToEndSafetyRehearsal");
const {createInMemoryRecoveryAdapter}=require("../functions/phase1411RecoveryRecordPreparation");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
async function main(){
 const report=assessReleaseReadiness();
 assert.equal(report.readyForLiveCustomerBookings,false);
 assert.equal(report.acceptingBookings,false);
 assert.equal(report.reservationCreated,false);
 assert.equal(report.status,"LAUNCH_BLOCKED_PENDING_PRODUCTION_IMPLEMENTATION");
 assert.equal(GATES.length,7);
 assert.ok(GATES.every(g=>g.ready===false&&g.reason.length>20));
 assert.deepEqual(await reserve(),DISABLED);
 assert.deepEqual(await createDisabledAtomicReservation({
  collection(){throw Error("reserve should never access Firestore");},
  runTransaction(){throw Error("reserve should never run transaction");}
 }).reserve(),DISABLED);
 const original={staffId:"kody",date:"2026-11-20",time:"10:00",durationMinutes:30,status:"confirmed"};
 const rehearsal=createEndToEndSafetyRehearsal({
  catalogue:{services:[{id:"cut",published:true,durationMinutes:30}],
   staff:[{id:"kody",active:true,serviceIds:["cut"]}]},
  schedules:[{id:"kody",weeklySchedule:{friday:{open:"09:00",close:"17:00"}},weeklyBreaks:[],timeOff:[]}],
  bookings:[original]
 },{adapter:createInMemoryRecoveryAdapter(),secret:"phase1415-test-secret-longer-than-32-bytes",clock:()=>1800000000000});
 assert.deepEqual(await rehearsal.reserve({serviceId:"cut"}),DISABLED);
 assert.deepEqual(rehearsal.read().bookings,[original],"original appointment preserved");
 const entry=read("functions/index.js");
 assert.ok(!/exports\.(?:reserve|createBooking|bookAppointment|customerBooking)\s*=/.test(entry),
  "no known production booking function exported");
 assert.ok(entry.includes("acceptingBookings: false"),"public catalogue publishing must remain disabled");
 const preview=read("website/book/index.html");
 assert.ok(preview.includes("Information only — appointments cannot yet be booked online."),"real-business page must display booking-disabled notice");
 assert.ok(preview.includes("Never submit or persist a selection as a booking."),"public selections must remain read-only");
 const nonAtomic=read("functions/phase1414EndToEndSafetyRehearsal.js");
 assert.ok(nonAtomic.includes("NOT atomic"),"non-atomic simulation risk must be documented");
 const freshness=read("functions/phase145ConsistentAvailability.js");
 assert.ok(freshness.includes("snapshot.updateTime"),"freshness issue remains a launch blocker");
 const secure=read("functions/phase1412SecureStoragePreparation.js");
 assert.ok(!secure.includes("firebase-admin"),"secure storage must remain test-only");
 const reportAgain=assessReleaseReadiness();
 report.gates[0].ready=true;
 assert.equal(reportAgain.gates[0].ready,false,"readiness gate cannot be changed by caller");
 console.log("PASS Phase 14.15 disabled booking, existing fixture preserved, launch blocked, documented risk gates");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
