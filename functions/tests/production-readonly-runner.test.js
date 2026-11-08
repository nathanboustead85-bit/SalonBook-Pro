"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {EXPECTED_EMAIL}=require("../runProductionReadOnly");
const source=fs.readFileSync(path.join(__dirname,"..","runProductionReadOnly.js"),"utf8");
test("dedicated service account is the expected production principal",()=>{
 assert.equal(EXPECTED_EMAIL,"boustio-readonly-verifier@salonbook-pro-ad5ff.iam.gserviceaccount.com");
});
test("runner refuses GitHub Actions, emulators and missing explicit approval",()=>{
 assert.match(source,/env\.GITHUB_ACTIONS/);
 assert.match(source,/env\.FIRESTORE_EMULATOR_HOST/);
 assert.match(source,/env\.BOUSTIO_READONLY_APPROVED!=="YES"/);
});
test("runner checks effective ADC service identity and project",()=>{
 assert.match(source,/credentials\.client_email!==EXPECTED_EMAIL/);
 assert.match(source,/project!==EXPECTED_PROJECT/);
});
test("runner has no direct Firestore writes or deploy",()=>{
 assert.doesNotMatch(source,/\.set\(|\.update\(|\.doc\([^)]*\)\.delete\(|\.create\(|\.runTransaction\(|firebase deploy/);
 assert.match(source,/await app\.delete\(\)/);
});
