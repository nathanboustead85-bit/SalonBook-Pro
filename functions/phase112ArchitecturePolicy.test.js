"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {ARCHITECTURE,assessArchitecture}=require("./phase112ArchitecturePolicy");
const {CONTRACT,validateContractShape}=require("./phase113BookingContract");
test("11.2 design retains production HOLD and disables public bookings",()=>{
 assert.equal(assessArchitecture().approved,false);
 assert.equal(ARCHITECTURE.productionWritesEnabled,false);
 assert.equal(ARCHITECTURE.publicBookingsEnabled,false);
 assert.equal(ARCHITECTURE.deploymentAllowed,false);
});
test("11.2 protected legacy source and migration marker are identified",()=>{
 assert.equal(ARCHITECTURE.bookingData.legacySource,"users/{uid}/liveData/bookings");
 assert.match(ARCHITECTURE.bookingData.migrationMarker,/android-bookings-v1/);
 assert.equal(ARCHITECTURE.bookingData.destructiveActionsAllowed,false);
});
test("11.2 separate signing, audit, booking and deployment trust boundaries required",()=>{
 for(const name of ["signingService","auditService","bookingApi","deployment","approvalIssuer","approvalConsumer"])
  assert.ok(ARCHITECTURE.trustBoundaries[name]);
});
test("11.2 unresolved production controls cannot be marked approved",()=>{
 const result=assessArchitecture();
 assert.ok(result.blockers.length>=6);
 assert.equal(result.productionWritesEnabled,false);
});
test("11.3 contract is explicitly demo-only and non-deployed",()=>{
 assert.equal(CONTRACT.deployed,false);
 assert.equal(CONTRACT.publicBookingsEnabled,false);
 assert.equal(CONTRACT.projectId,"demo-boustio-legacy-init");
});
test("11.3 contract requires idempotency and server-side concurrency protection",()=>{
 assert.ok(CONTRACT.requestFields.includes("idempotencyKey"));
 assert.ok(CONTRACT.invariants.some(x=>/atomic transaction/.test(x)));
 assert.ok(CONTRACT.invariants.some(x=>/duration/.test(x)));
});
test("11.3 request shape denies missing fields, unknown properties and invalid input",()=>{
 const valid=Object.fromEntries(CONTRACT.requestFields.map(k=>[k,"demo"]));
 assert.equal(validateContractShape(valid),true);
 assert.equal(validateContractShape({...valid,admin:true}),false);
 assert.equal(validateContractShape({...valid,serviceId:""}),false);
 assert.equal(validateContractShape(null),false);
});
test("11.2/11.3 prototypes are not exported by deployed functions entrypoint",()=>{
 const index=fs.readFileSync(path.join(__dirname,"index.js"),"utf8");
 for(const moduleName of ["phase112ArchitecturePolicy","phase113BookingContract"])
  assert.equal(index.includes(moduleName),false);
});
test("11.2 existing public booking page remains preview-only",()=>{
 const page=fs.readFileSync(path.join(__dirname,"../website/book/index.html"),"utf8");
 assert.match(page,/Booking unavailable — preview only/);
 assert.match(page,/disabled-action/);
});
test("11.2 workflow contains no production deployment or credential binding",()=>{
 const workflow=fs.readFileSync(path.join(__dirname,"../.github/workflows/legacy-mode-emulator-safety.yml"),"utf8");
 assert.doesNotMatch(workflow,/firebase deploy|gcloud functions deploy|GOOGLE_APPLICATION_CREDENTIALS:/);
});
