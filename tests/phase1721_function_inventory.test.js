"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const code=fs.readFileSync(require("node:path").join(__dirname,"../scripts/phase1721_function_inventory.js"),"utf8");
for(const required of ["VERIFY_FUNCTION_INVENTORY","functions\",[\"list","--project=salonbook-pro-ad5ff","--format=json","PUBLISH_BUSINESS","NO_FUNCTION_INVOCATION"])assert.ok(code.includes(required),required);
for(const forbidden of ["functions\",\"deploy","functions\",\"call","firebase deploy","db.collection(",".set(","--format=json(name"])assert.ok(!code.includes(forbidden),forbidden);
console.log("PASS Phase 17.21 read-only Cloud Functions inventory and no-write safeguards");
