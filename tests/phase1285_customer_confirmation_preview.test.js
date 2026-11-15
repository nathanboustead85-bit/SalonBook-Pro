"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {prepareConfirmationPreview}=require("../web/phase1285/customerConfirmationPreview");
const catalogue=()=>({schemaVersion:1,slug:"demo-salon",published:true,businessName:"Demo Salon",
 services:[{id:"cut",name:"Haircut",pricePence:2050,durationMinutes:30,published:true}],
 staff:[{id:"sam",name:"Sam",active:true,serviceIds:["cut"]}],ownerUid:"secret",clients:[{email:"private@example.com"}]});
const slots=()=>[{date:"2026-11-20",time:"10:00",staffId:"sam",serviceId:"cut",available:true}];
const customer=()=>({name:"Alex Example",email:"alex@example.com",phone:"07123456789",consent:true});
const run=(c=customer(),p=catalogue(),s=slots())=>prepareConfirmationPreview(p,"demo-salon","cut","sam","2026-11-20","10:00",s,c);
const result=run();
assert.equal(result.status,"CONFIRMATION_PREVIEW_READY");
assert.equal(result.bookingEnabled,false);
assert.equal(result.confirmation.customerName,"Alex Example");
assert.equal(result.confirmation.totalLabel,"£20.50");
assert.equal(result.confirmation.endTime,"10:30");
assert.ok(result.confirmation.heading.includes("NO REAL APPOINTMENT"));
assert.ok(Object.isFrozen(result.confirmation));
assert.equal("email" in result.confirmation,false);
assert.equal("phone" in result.confirmation,false);
assert.equal("ownerUid" in result.confirmation,false);
assert.equal("clients" in result.confirmation,false);
for(const c of [
 null,{}, {...customer(),name:"A"}, {...customer(),name:"<script>"},
 {...customer(),email:"invalid"}, {...customer(),phone:"123"},
 {...customer(),consent:false}, {...customer(),consent:undefined}
])assert.equal(run(c).status,"CONFIRMATION_PREVIEW_UNAVAILABLE");
assert.equal(run(customer(),{...catalogue(),published:false}).bookingEnabled,false);
assert.equal(run(customer(),catalogue(),[]).confirmation,null);
const source=fs.readFileSync("web/phase1285/customerConfirmationPreview.js","utf8");
for(const forbidden of ["fetch(","XMLHttpRequest","localStorage","sessionStorage","indexedDB","firebase.","WebSocket(","sendEmail","sendSMS"])assert.ok(!source.includes(forbidden),forbidden);
console.log("PASS Phase 12.85 fictional customer confirmation and privacy safety");
