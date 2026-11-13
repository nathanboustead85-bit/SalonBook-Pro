"use strict";
const assert=require("node:assert/strict");
const {SERVICES,TIMES,validatePreview,confirmationPreview}=require("../web/phase1237/bookingPreview");
assert.equal(SERVICES.length,3);assert.equal(new Set(SERVICES.map(s=>s.id)).size,3);
console.log("PASS demo services have unique IDs");
assert.equal(TIMES.length,5);assert.equal(new Set(TIMES).size,5);
console.log("PASS sample time slots are unique");
const base={serviceId:"cut",time:"09:00",customerName:"Demo Customer"};
assert.equal(validatePreview(base).valid,true);
console.log("PASS valid service and time accepted");
for(const serviceId of ["",null,"unknown"]){assert.equal(validatePreview({...base,serviceId}).valid,false)}
console.log("PASS unknown services rejected");
for(const time of ["",null,"23:59","<script>"]){assert.equal(validatePreview({...base,time}).valid,false)}
console.log("PASS unknown times rejected");
for(const customerName of ["",null,"A","x".repeat(81)])assert.equal(validatePreview({...base,customerName}).valid,false);
console.log("PASS invalid customer names rejected");
const result=confirmationPreview(base);
assert.equal(result.status,"PREVIEW_ONLY");assert.equal(result.bookingCreated,false);
assert.equal(result.pricePence,2000);assert.equal(result.durationMinutes,30);
console.log("PASS confirmation remains preview-only and price matches");
assert.equal(confirmationPreview({}).status,"INVALID_PREVIEW");
assert.equal(confirmationPreview({}).bookingCreated,false);
console.log("PASS invalid preview cannot create appointment");
assert.equal(Object.isFrozen(result),true);assert.equal(Object.isFrozen(SERVICES),true);
console.log("PASS preview state immutable");
