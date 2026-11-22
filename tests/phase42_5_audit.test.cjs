"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {auditPhase42,blockers,sources,tests,workflows}=require("../web/phase42/final-audit-42-5");
test("Phase 42 source-grounded audit passes isolated checks only",()=>{const result=auditPhase42();assert.deepEqual(result.failures,[]);assert.equal(result.status,"ISOLATED_AUDIT_CHECKS_PASSED");assert.equal(result.productionReady,false);assert.equal(result.stagingApproved,false)});
test("all four isolated phases have source and regression evidence",()=>{assert.equal(sources.length,4);assert.equal(tests.length,8);assert.equal(workflows.length,4)});
test("every launch blocker remains explicitly open",()=>{assert.equal(blockers.length,7);assert.ok(blockers.every(b=>b.status==="OPEN"));assert.ok(blockers.some(b=>/appointments/.test(b.reason)))});
test("all live capabilities and deployment remain denied",()=>{const a=auditPhase42();for(const key of ["canBook","canPay","canMessage","canDeploy","migrationApproved","revisionVerified","stagingConnected"])assert.equal(a[key],false,key)});
test("prior Phase 41 audit blockers remain visible",()=>{const a=auditPhase42();assert.equal(a.priorBlockers.length,6);assert.ok(a.priorBlockers.every(x=>x.status==="OPEN"))});
