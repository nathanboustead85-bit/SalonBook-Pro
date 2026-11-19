"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {audit}=require("../scripts/phase26_15_chat_release_audit");
test("Release audit fails closed under production defaults",()=>{
 const result=audit();
 assert.equal(result.decision,"NOT_READY_FOR_PUBLIC_LAUNCH");
 assert.equal(result.checks.chatDefaultDisabled,true);
 assert.equal(result.checks.abuseBudgetDefaultDisabled,true);
});
test("Customer chat gate and atomic abuse budget are present",()=>{
 const r=audit();
 assert.equal(r.checks.customerStartGated,true);
 assert.equal(r.checks.customerSendGated,true);
 assert.equal(r.checks.customerReadGated,true);
 assert.equal(r.checks.atomicBudgetAvailable,true);
});
test("Firestore rules deny direct customer message writes",()=>{
 const r=audit();
 assert.equal(r.checks.customerDirectWritesDenied,true);
 assert.equal(r.checks.messageDirectWritesDenied,true);
});
test("App Check enforcement remains a release blocker",()=>{
 const r=audit();
 assert.equal(r.checks.appCheckEnforced,false);
 assert.ok(r.blockers.includes("appCheckEnforced"));
});
test("Anonymous rotation and monitoring remain release blockers",()=>{
 const r=audit();
 assert.equal(r.checks.trustedRotationProtection,false);
 assert.equal(r.checks.operationalMonitoringVerified,false);
 assert.ok(r.blockers.includes("trustedRotationProtection"));
 assert.ok(r.blockers.includes("operationalMonitoringVerified"));
});
test("Environment claims cannot override independently unverified controls",()=>{
 const env=Object.fromEntries(["BOUSTIO_CHAT_ENABLED","BOUSTIO_CHAT_ABUSE_BUDGET_ENABLED","BOUSTIO_CHAT_APP_CHECK_ENFORCED","BOUSTIO_CHAT_TRUSTED_ABUSE_SIGNAL","BOUSTIO_CHAT_OPERATIONAL_MONITORING"].map(k=>[k,"true"]));
 const r=audit({env});
 assert.equal(r.decision,"NOT_READY_FOR_PUBLIC_LAUNCH");
 assert.ok(r.blockers.includes("appCheckEnforced"));
});
test("Attachment uploads remain outside approved launch scope",()=>{
 const r=audit();
 assert.equal(r.checks.attachmentSecurityVerified,false);
 assert.ok(r.blockers.includes("attachmentSecurityVerified"));
});
test("Audit is deterministic and read-only",()=>{
 const a=audit(),b=audit();
 assert.deepEqual(a,b);
});
