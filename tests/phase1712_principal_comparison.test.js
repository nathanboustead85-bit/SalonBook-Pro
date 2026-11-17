"use strict";
const assert=require("node:assert/strict");
const {compare,run}=require("../scripts/phase1712_principal_comparison");
const expected="repo:nathanboustead85-bit/SalonBook-Pro:environment:boustio-readonly-verification";
const claims={sub:expected,repository:"nathanboustead85-bit/SalonBook-Pro"};
const jwt=c=>["header",Buffer.from(JSON.stringify(c)).toString("base64url"),"signature"].join(".");
const env={BOUSTIO_PHASE1712_APPROVED:"true",ACTIONS_ID_TOKEN_REQUEST_URL:"https://pipelines.actions.githubusercontent.com/token",ACTIONS_ID_TOKEN_REQUEST_TOKEN:"test-secret"};
(async()=>{
 assert.equal(compare(claims).subject,"MATCH");
 assert.equal(compare({...claims,sub:"repo:other-owner/SalonBook-Pro:environment:boustio-readonly-verification"}).owner,"DIFFERENT");
 assert.equal(compare({...claims,sub:"repo:nathanboustead85-bit/other-repo:environment:boustio-readonly-verification"}).name,"DIFFERENT");
 assert.equal(compare({...claims,sub:"repo:nathanboustead85-bit/salonbook-pro:environment:boustio-readonly-verification"}).name,"CASE_DIFFERENCE");
 assert.equal(compare({...claims,sub:"repo:nathanboustead85-bit/SalonBook-Pro:environment:other"}).environment,"DIFFERENT");
 assert.ok(!JSON.stringify(compare({...claims,sub:"repo:secret-owner/secret-name:environment:secret-env"})).includes("secret-"));
 assert.equal((await run({env:{},request:async()=>jwt(claims)})).status,"DISABLED");
 assert.equal((await run({env,request:async()=>jwt(claims)})).comparison.subject,"MATCH");
 assert.equal((await run({env,request:async()=>{throw Error("private-token");}})).status,"DIAGNOSTIC_UNAVAILABLE");
 console.log("PASS Phase 17.12 component comparison and no-claims-output safeguards");
})().catch(e=>{console.error(e);process.exitCode=1;});
