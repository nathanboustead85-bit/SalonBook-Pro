"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const code=fs.readFileSync(require("node:path").join(__dirname,"../scripts/phase1717_publish_path_readonly.js"),"utf8");
for(const fragment of ['readOnly:true','maxAttempts:1','collection("business").doc("profile")','collection("publicBusinesses").doc(owner)','BOUSTIO_PHASE1717_APPROVED'])assert.ok(code.includes(fragment),fragment);
for(const forbidden of [/\.data\s*\(/,/\.set\s*\(/,/\.create\s*\(/,/\.update\s*\(/,/\.delete\s*\(/,/\.add\s*\(/,/\.get\s*\(\s*["']/])assert.ok(!forbidden.test(code),String(forbidden));
console.log("PASS Phase 17.17 publish-path read-only diagnostic safety");
