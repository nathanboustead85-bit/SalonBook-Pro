"use strict";
// Phase 15.18: source-backed, fail-closed release audit. Does not deploy or enable bookings.
const fs=require("node:fs");
const path=require("node:path");
const {assessReleaseReadiness}=require("./phase1415ReleaseReadiness");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const REQUIRED=Object.freeze([
 "phase151BookingInfrastructurePreparation","phase152AtomicTransactionPreparation",
 "phase153AtomicBookingSimulation","phase154PersistentRecoveryPreparation",
 "phase155MultiDeviceRecoverySimulation","phase156TransactionRecoveryIntegration",
 "phase157TransactionRetryStressSimulation","phase158TimeoutRecoveryStressSimulation",
 "phase159RestartRecoveryPreparation","phase1510RecoveryConsistencyPreparation",
 "phase1511RecoveryOwnershipIsolation","phase1512ConcurrentRecoveryPreparation",
 "phase1513RecoveryFailureInjection","phase1514RecoveryAuditPreparation",
 "phase1515RecoverySecurityMonitor","phase1516PersistentRecoveryMonitor",
 "phase1517RecoveryMonitoringStress"]);
function auditBookingInfrastructure({root=path.resolve(__dirname,"..")}={}){
 const checks=[];
 function check(id,passed,detail){checks.push(Object.freeze({id,passed:!!passed,detail}));}
 function read(relative){
  try{return fs.readFileSync(path.resolve(root,relative),"utf8");}
  catch{return null;}
 }
 const entry=read("functions/index.js");
 const website=read("website/book/index.html");
 const workflow=read(".github/workflows/boustio-phase-1292-samsung-preview.yml");
 const readiness=assessReleaseReadiness();
 check("production_booking_exports_disabled",!!entry
  &&!/exports\s*(?:\.\s*(?:reserve|createBooking|bookAppointment|customerBooking)|\[\s*["'](?:reserve|createBooking|bookAppointment|customerBooking)["']\s*\])\s*=/.test(entry),
  "No known booking callable export in inspected Firebase entry point");
 check("public_catalogue_booking_disabled",!!entry&&entry.includes("acceptingBookings: false"),
  "Catalogue publication must not advertise live booking");
 check("public_booking_notice",!!website&&website.includes("Information only — appointments cannot yet be booked online.")
  &&website.includes("Never submit or persist a selection as a booking."),
  "Public booking page is informational only");
 check("release_gates_blocked",readiness.readyForLiveCustomerBookings===false
  &&readiness.gates.length===7&&readiness.gates.every(g=>g.ready===false),
  "Seven production release blockers remain unresolved");
 for(const name of REQUIRED){
  const module=read("functions/"+name+".js");
  check("module_"+name,!!module&&!!workflow&&workflow.includes("functions/"+name+".js"),
   "Preparation module present and included in CI change detection");
 }
 check("phase1517_test_in_ci",!!workflow
  &&workflow.includes("node tests/phase1517_recovery_monitoring_stress.test.js"),
  "Latest monitoring stress tests run in CI");
 check("non_atomic_rehearsal_documented",(read("functions/phase1414EndToEndSafetyRehearsal.js")||"").includes("NOT atomic"),
  "Simulated two-step reservation is not a production atomic transaction");
 check("freshness_risk_documented",(read("functions/phase145ConsistentAvailability.js")||"").includes("snapshot.updateTime"),
  "Document updateTime cannot establish fresh server snapshot");
 const passed=checks.every(c=>c.passed);
 return Object.freeze({phase:"15.18",status:passed?"AUDIT_CHECKS_PASSED_LAUNCH_BLOCKED":"AUDIT_CHECKS_FAILED_LAUNCH_BLOCKED",
  auditChecksPassed:passed,readyForLiveCustomerBookings:false,acceptingBookings:false,
  reservationCreated:false,legacyAppointmentsUntouched:true,
  checks:Object.freeze(checks),launchBlockers:Object.freeze(readiness.gates.map(g=>Object.freeze({...g})))});
}
async function reserve(){return {...DISABLED};}
module.exports=Object.freeze({auditBookingInfrastructure,reserve,REQUIRED});
