"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {prepareSelection}=require("../web/phase1282/serviceStaffSelection");
const sample=()=>({schemaVersion:1,slug:"demo-salon",published:true,businessName:"Demo Salon",
 services:[{id:"cut",name:"Haircut",pricePence:2000,durationMinutes:30,published:true},{id:"hidden",name:"Hidden",pricePence:100,durationMinutes:15,published:false}],
 staff:[{id:"sam",name:"Sam",active:true,serviceIds:["cut"]},{id:"pat",name:"Pat",active:true,serviceIds:["hidden"]},{id:"off",name:"Off",active:false,serviceIds:["cut"]}],
 clients:[{email:"private@example.com"}],ownerUid:"secret"});
const ready=prepareSelection(sample(),"demo-salon","cut","sam");
assert.equal(ready.status,"SELECTION_PREVIEW_READY");
assert.equal(ready.bookingEnabled,false);
assert.equal(ready.selection.selectedStaff.name,"Sam");
assert.equal(ready.selection.summary,"Haircut · 30 min · £20.00");
assert.deepEqual(ready.selection.eligibleStaff.map(p=>p.id),["sam"]);
assert.ok(Object.isFrozen(ready.selection));
assert.ok(Object.isFrozen(ready.selection.eligibleStaff));
assert.equal("clients" in ready.selection,false);
assert.equal("ownerUid" in ready.selection,false);
assert.equal(prepareSelection(sample(),"demo-salon","cut").selection.selectedStaff,null);
for(const [payload,slug,service,staff] of [
 [sample(),"wrong","cut","sam"],
 [{...sample(),published:false},"demo-salon","cut","sam"],
 [sample(),"demo-salon","hidden","pat"],
 [sample(),"demo-salon","cut","pat"],
 [sample(),"demo-salon","cut","off"],
 [sample(),"demo-salon","","sam"],
 [sample(),"demo-salon","missing","sam"],
 [sample(),"demo-salon","cut",123]
])assert.equal(prepareSelection(payload,slug,service,staff).bookingEnabled,false);
assert.equal(prepareSelection(sample(),"demo-salon","hidden","pat").status,"SELECTION_UNAVAILABLE");
assert.equal(prepareSelection(sample(),"demo-salon","cut","pat").status,"SELECTION_UNAVAILABLE");
const source=fs.readFileSync("web/phase1282/serviceStaffSelection.js","utf8");
for(const forbidden of ["fetch(","XMLHttpRequest","localStorage","sessionStorage","indexedDB","firebase.","WebSocket("])assert.ok(!source.includes(forbidden),forbidden);
console.log("PASS Phase 12.82 service/staff selection safety");
