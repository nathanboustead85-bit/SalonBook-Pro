"use strict";
const assert=require("node:assert/strict");
const {REQUIRED,assessReadiness}=require("../functions/migrationReadinessGate");
function blocked(result){
 assert.equal(result.status,"NOT_READY");
 assert.equal(result.migrationPerformed,false);
 assert.equal(result.liveBookingsEnabled,false);
 assert.equal(result.deploymentAuthorized,false);
 assert.equal(result.safeToMigrateAutomatically,false);
}
blocked(assessReadiness());
console.log("PASS absent evidence fails closed");
blocked(assessReadiness(null));
console.log("PASS null evidence fails closed");
blocked(assessReadiness([]));
console.log("PASS array evidence fails closed");
const all=Object.fromEntries(REQUIRED.map(k=>[k,{
 passed:true,evidenceId:"review/phase1230-"+k,reviewedBy:"Independent Reviewer",
 reviewedAt:"2026-11-13T00:00:00.000Z"
}]));
for(const key of REQUIRED){
 const missing={...all};delete missing[key];
 const result=assessReadiness(missing);
 blocked(result);
 assert(result.missing.includes(key));
 console.log("PASS missing gate blocks:",key);
}
const forged={...all,verifiedOwnerConsent:true};
blocked(assessReadiness(forged));
console.log("PASS boolean-only consent cannot bypass gate");
const empty={...all,immutableBackupStored:{passed:true,evidenceId:"",reviewedBy:"",reviewedAt:""}};
blocked(assessReadiness(empty));
console.log("PASS unsupported backup claim rejected");
const invalidDate={...all,restoreDrillPassed:{...all.restoreDrillPassed,reviewedAt:"not-a-date"}};
blocked(assessReadiness(invalidDate));
console.log("PASS invalid review date rejected");
const complete=assessReadiness(all);
assert.equal(complete.status,"REVIEW_REQUIRED");
assert.equal(complete.missing.length,0);
assert.equal(complete.safeToMigrateAutomatically,false);
assert.equal(complete.deploymentAuthorized,false);
console.log("PASS complete evidence still requires separate human release review");
assert.equal(Object.isFrozen(complete),true);
console.log("PASS readiness result immutable");
