"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {classify,extractPermissions,checks}=require("../scripts/phase1730_readonly_diagnostic.js");
for(const [input,expected] of [
 ["Permission 'cloudfunctions.functions.get' denied","CLOUD_FUNCTIONS_GET_PERMISSION_DENIED"],
 ["Permission 'run.services.get' denied","CLOUD_RUN_GET_PERMISSION_DENIED"],
 ["iam.serviceAccounts.getAccessToken denied","IDENTITY_TOKEN_IMPERSONATION_DENIED"],
 ["API has not been used or is disabled","API_NOT_ENABLED_OR_ACCESS_BLOCKED"],
 ["PERMISSION_DENIED 403","ACCESS_DENIED_UNSPECIFIED"],
 ["NOT_FOUND 404","RESOURCE_NOT_FOUND_OR_NOT_VISIBLE"],
 ["unknown","OTHER_ERROR"]
])assert.equal(classify(input),expected);
assert.deepEqual(extractPermissions("cloudfunctions.functions.get and run.services.get"),["cloudfunctions.functions.get","run.services.get"]);
assert.equal(checks.length,2);
for(const c of checks){
 assert.ok(c.args.includes("--project=salonbook-pro-ad5ff"));
 assert.ok(c.args.includes("--region=europe-west2"));
 assert.ok(c.args.includes("--format=json"));
 assert.ok(c.args.includes("describe"));
 assert.ok(!c.args.some(x=>/deploy|delete|update|invoke|call|create/.test(x)));
}
const y=fs.readFileSync(".github/workflows/boustio-phase-1730-readonly-diagnostic.yml","utf8");
assert.match(y,/environment: boustio-function-deployment/);
assert.match(y,/DIAGNOSE_READONLY_ACCESS/);
assert.match(y,/github\.ref == 'refs\/heads\/milestone-customer-booking-experience'/);
assert.doesNotMatch(y,/firebase deploy|gcloud functions deploy/);
console.log("PASS Phase 17.30 read-only permission diagnostics and guard tests");
