"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const s=fs.readFileSync(path.join(__dirname,"../scripts/phase1719_function_deployment.js"),"utf8");
for(const x of ["VERIFY_FUNCTION_DEPLOYMENT","functions\",\"describe","publishBusiness","--gen2","--region=europe-west2","--project=salonbook-pro-ad5ff","INSUFFICIENT_METADATA_PERMISSIONS","NO_FUNCTION_INVOCATION"])assert.ok(s.includes(x),"missing "+x);
for(const x of ["functions\",\"deploy","functions\",\"call","firebase deploy","db.collection(",".set(","--format=yaml"])assert.ok(!s.includes(x),"forbidden "+x);
console.log("PASS Phase 17.19 read-only Cloud Function deployment inspection safeguards");
