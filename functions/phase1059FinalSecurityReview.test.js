"use strict";
/** Phase 10.59 final review gates: static emulator-only evidence, never production approval. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {POLICY,evaluateReadiness}=require("./phase1050ProductionArchitecturePolicy");
const {RIGHTS}=require("./phase1056EmulatorPermissions");
const root=__dirname;
test("Phase 10.59 production readiness remains explicitly blocked",()=>{
 const result=evaluateReadiness();
 assert.equal(result.approved,false);
 assert.equal(result.productionWriteAllowed,false);
 assert.ok(result.blockers.includes("independent audit not configured"));
 assert.ok(result.blockers.includes("key custody not configured"));
});
test("Phase 10.59 no role combines signing with audit append or Firestore Admin",()=>{
 for(const role of Object.values(POLICY.roles)){
  assert.equal(role.firestoreAdmin,false);
  assert.equal(role.sign&&role.auditAppend,false);
 }
});
test("Phase 10.59 owner, issuer, consumer, auditor and operator capabilities remain disjoint",()=>{
 for(const [role,actions] of Object.entries(RIGHTS)){
  assert.equal(new Set(actions).size,actions.length);
  for(const [other,otherActions] of Object.entries(RIGHTS)){
   if(role!==other)assert.deepEqual(actions.filter(x=>otherActions.includes(x)),[]);
  }
 }
});
test("Phase 10.59 protected booking paths excluded from approval write scopes",()=>{
 const writes=[...POLICY.issuanceWrites,...POLICY.consumptionWrites];
 for(const protectedPath of POLICY.prohibitedWrites)assert.equal(writes.includes(protectedPath),false);
});
test("Phase 10.59 trusted emulator modules are not exported by functions index",()=>{
 const index=fs.readFileSync(path.join(root,"index.js"),"utf8");
 for(const moduleName of ["phase1046TrustedOrchestrator","phase1048SignedApproval","phase1053DurableAuditPrototype","phase1056EmulatorPermissions"])
  assert.equal(index.includes(moduleName),false,moduleName+" must not be deployed");
});
test("Phase 10.59 emulator workflow uses demo project, no production credentials or deploy command",()=>{
 const workflow=fs.readFileSync(path.join(root,"../.github/workflows/legacy-mode-emulator-safety.yml"),"utf8");
 assert.match(workflow,/GCLOUD_PROJECT: demo-boustio-legacy-init/);
 assert.match(workflow,/GOOGLE_CLOUD_PROJECT: demo-boustio-legacy-init/);
 assert.doesNotMatch(workflow,/firebase deploy|gcloud functions deploy|GOOGLE_APPLICATION_CREDENTIALS:/);
});
test("Phase 10.59 independent audit and key custody remain unconfigured",()=>{
 assert.equal(POLICY.independentAudit.configured,false);
 assert.equal(POLICY.keyCustody.configured,false);
 assert.equal(POLICY.productionWriteAllowed,false);
});
