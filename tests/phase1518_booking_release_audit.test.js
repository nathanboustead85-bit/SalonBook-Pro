"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {auditBookingInfrastructure,reserve,REQUIRED}=require("../functions/phase1518BookingReleaseAudit");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const root=path.resolve(__dirname,"..");
async function main(){
 const report=auditBookingInfrastructure();
 assert.equal(report.phase,"15.18");
 assert.equal(report.status,"AUDIT_CHECKS_PASSED_LAUNCH_BLOCKED");
 assert.equal(report.auditChecksPassed,true);
 assert.equal(report.readyForLiveCustomerBookings,false);
 assert.equal(report.acceptingBookings,false);
 assert.equal(report.reservationCreated,false);
 assert.equal(report.legacyAppointmentsUntouched,true);
 assert.equal(report.launchBlockers.length,7);
 assert.ok(report.launchBlockers.every(g=>g.ready===false));
 assert.ok(report.checks.length>=REQUIRED.length+6);
 assert.ok(report.checks.every(c=>c.passed));
 assert.deepEqual(await reserve(),DISABLED);
 // Mutated release output must not change the source of truth.
 report.launchBlockers[0].ready=true;
 assert.equal(auditBookingInfrastructure().launchBlockers[0].ready,false);
 // Missing or unsafe source must fail closed, never return launch-ready.
 const empty=fs.mkdtempSync(path.join(os.tmpdir(),"boustio-1518-"));
 try{
  const bad=auditBookingInfrastructure({root:empty});
  assert.equal(bad.auditChecksPassed,false);
  assert.equal(bad.readyForLiveCustomerBookings,false);
  assert.equal(bad.acceptingBookings,false);
  assert.equal(bad.status,"AUDIT_CHECKS_FAILED_LAUNCH_BLOCKED");
 }finally{fs.rmSync(empty,{recursive:true,force:true});}
 const entry=fs.readFileSync(path.join(root,"functions/index.js"),"utf8");
 assert.ok(!entry.includes("phase1518BookingReleaseAudit"),"audit must not become a live callable");
 const website=fs.readFileSync(path.join(root,"website/book/index.html"),"utf8");
 assert.ok(website.includes("Information only — appointments cannot yet be booked online."));
 const fixtures=[{id:"original-1",date:"2026-11-20"},{id:"original-2",date:"2026-11-20"}];
 const before=JSON.stringify(fixtures);
 await reserve();
 auditBookingInfrastructure();
 assert.equal(JSON.stringify(fixtures),before,"audit must not touch existing booking fixtures");
 console.log("PASS Phase 15.18 source audit, seven blocked launch gates, fail closed, booking disabled, fixtures untouched");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
