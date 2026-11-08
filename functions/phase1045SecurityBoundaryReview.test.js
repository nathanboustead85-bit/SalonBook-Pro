"use strict";
/** Phase 10.45: security boundary regression checks.
 * These are deliberately fail-closed static guards, not a production certification.
 */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=__dirname;
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const modules=[
 "phase1040EmulatorLockedInitialization.js",
 "phase1041EmulatorApprovalIssuance.js",
 "phase1043TrustedEmulatorEvidence.js",
 "phase1044KeyRotationAndAudit.js"
];
test("none of the security prototypes are imported or exported from production functions index",()=>{
 const index=read("index.js");
 for(const name of modules)assert.equal(index.includes(name.replace(/\.js$/,"")),false,name);
 assert.doesNotMatch(index,/initialiseWithSingleUseApproval|issueEmulatorApproval|revokeApprovalEmulator|verifySignedOperatorAssertion/);
});
test("all Firestore-writing prototypes require emulator host and demo project",()=>{
 for(const name of [modules[0],modules[1],modules[3]]){
  const s=read(name);
  assert.match(s,/FIRESTORE_EMULATOR_HOST/,name);
  assert.match(s,/GOOGLE_APPLICATION_CREDENTIALS/,name);
  assert.match(s,/db\?\.projectId/,name);
  assert.match(s,/executionEnabled\s*!==\s*true/,name);
 }
});
test("authentication verifier requires Auth emulator and Admin verifyIdToken",()=>{
 const s=read(modules[2]);
 assert.match(s,/FIREBASE_AUTH_EMULATOR_HOST/);
 assert.match(s,/admin\.auth\(\)\.verifyIdToken\(token,true\)/);
 assert.match(s,/email_verified!==true/);
});
test("issuance requires independent operator and owner verification",()=>{
 const s=read(modules[1]);
 assert.match(s,/verifyOwnerToken\(ownerToken,true\)/);
 assert.match(s,/verifyOperatorAssertion\(operatorAssertion\)/);
 assert.match(s,/operator\.archiveSha256!==archive\?\.sourceSha256/);
 assert.match(s,/tx\.create\(approval,/);
 assert.match(s,/tx\.create\(audit,/);
});
test("consumption and revocation both guard approval state within transactions",()=>{
 const c=read(modules[0]),r=read(modules[3]);
 assert.match(c,/tx\.get\(approvalRef\)/);
 assert.match(c,/record\.status!=="approved"/);
 assert.match(c,/tx\.update\(approvalRef,/);
 assert.match(c,/tx\.create\(modeRef,/);
 assert.match(r,/tx\.get\(approval\)/);
 assert.match(r,/record\.status!=="approved"/);
 assert.match(r,/tx\.update\(approval,/);
 assert.match(r,/tx\.create\(audit,/);
});
test("key rotation checks status and validity; audit checks Ed25519 signatures",()=>{
 const s=read(modules[3]);
 assert.match(s,/record\.status!=="active"/);
 assert.match(s,/validFromMs/);
 assert.match(s,/validUntilMs/);
 assert.match(s,/crypto\.verify\(null,Buffer\.from\(auditMessage\(record\)\)/);
});
test("legacy booking data cannot be deleted or updated by approval consumption",()=>{
 const s=read(modules[0]);
 assert.doesNotMatch(s,/tx\.(delete|set|update)\(sourceRef/);
 assert.match(s,/digestBookings\(json\)!==verified\.hash/);
 assert.match(s,/!appts\.empty\|\|!lockDocs\.empty/);
});
test("no Firebase deployment command or production project in security modules",()=>{
 for(const name of modules){
  const s=read(name);
  assert.doesNotMatch(s,/firebase\s+deploy|salonbook-pro-ad5ff/);
 }
});
test("documented unresolved trust boundaries remain explicit",()=>{
 const docs=fs.readFileSync(path.join(root,"..","docs","phase-10-45-final-security-boundary-review.md"),"utf8");
 for(const term of ["callback injection","trusted clock","operator key custody","immutable audit","Admin SDK","approval write scope"])
  assert.ok(docs.includes(term),term);
});
