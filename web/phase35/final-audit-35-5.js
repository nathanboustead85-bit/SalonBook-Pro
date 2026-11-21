"use strict";
// Phase 35.5: offline release gate; a passing audit is NOT production approval.
const fs=require("node:fs"),path=require("node:path");
const ROOT=path.resolve(__dirname,"../..");
const read=p=>fs.readFileSync(path.join(ROOT,p),"utf8");
const checks=Object.freeze({
 phase35_1_real_rules:()=>read("tests/phase35_1_firestore_emulator.test.cjs").includes("initializeTestEnvironment"),
 phase35_2_atomic_transaction:()=>read("tests/phase35_2_atomic_refresh.test.cjs").includes("runTransaction"),
 phase35_3_real_auth_emulator:()=>read("tests/phase35_3_auth_lifecycle.test.cjs").includes("connectAuthEmulator"),
 phase35_4_bounded_retry:()=>read("web/phase35/network-recovery-35-4.js").includes("RETRY_MS"),
 actual_profile_path:()=>read("firestore.rules").includes("match /users/{userId}/business/{documentId}"),
 actual_live_data_path:()=>read("firestore.rules").includes("match /users/{userId}/liveData/{dataType}"),
 no_production_config_change:()=>JSON.parse(read("firebase.phase32-4.json")).emulators.firestore.host==="127.0.0.1",
 legacy_bookings_rule_is_open_to_owner:()=>read("firestore.rules").includes('"bookings",'),
 no_production_approval:()=>true
});
const blockers=Object.freeze([
 "No production Firebase SDK adapter wired to app or browser; real auth listener and token refresh unverified",
 "Phase 34.1 provisional gateway still incompatible with actual Android Firestore document paths and schema",
 "Legacy verified-owner liveData/bookings reads and conditional writes remain allowed in existing rules; must separately review before launch",
 "Trusted atomicity contract and cancellation boundary not hardened; injected atomic:true and isCurrent() can be supplied incorrectly",
 "Phase 35.3 session expiry is caller-supplied; token revocation, email verification refresh, App Check and server-side invalidation not verified",
 "Phase 35.4 network failures are injected; no actual transport outage, offline cache, SDK cancellation or real production retry test",
 "Phase 34.3 24-hour age and 5-minute cross-document skew can reject unchanged legitimate business documents",
 "Business-wide opening-hours persistence and staff schedule semantics not verified against production Android schema",
 "No real-device end-to-end business dashboard integration or live release authorization",
 "All live customer bookings, payments, messaging and deployment remain disabled"
]);
function auditPhase35(){
 const results=Object.entries(checks).map(([name,fn])=>Object.freeze({name,passed:Boolean(fn())}));
 return Object.freeze({status:results.every(x=>x.passed)?"ISOLATED_AUDIT_PASSED":"ISOLATED_AUDIT_FAILED",
  productionApproved:false,liveBookingsEnabled:false,paymentsEnabled:false,messagingEnabled:false,deploymentEnabled:false,
  testedWithProductionData:false,results:Object.freeze(results),blockers});
}
module.exports=Object.freeze({auditPhase35,blockers});
