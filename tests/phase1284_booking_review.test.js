"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {prepareBookingReview}=require("../web/phase1284/bookingReview");
const sample=()=>({schemaVersion:1,slug:"demo-salon",published:true,businessName:"Demo Salon",
 services:[{id:"cut",name:"Haircut",pricePence:2050,durationMinutes:30,published:true}],
 staff:[{id:"sam",name:"Sam",active:true,serviceIds:["cut"]}],
 clients:[{email:"private@example.com"}],ownerUid:"private"});
const slots=()=>[{date:"2026-11-20",time:"10:00",staffId:"sam",serviceId:"cut",available:true},
 {date:"2026-11-20",time:"11:00",staffId:"sam",serviceId:"cut",available:false}];
const review=(p=sample(),date="2026-11-20",time="10:00",list=slots(),staff="sam")=>
 prepareBookingReview(p,"demo-salon","cut",staff,date,time,list);
const r=review();
assert.equal(r.status,"REVIEW_PREVIEW_READY");
assert.equal(r.bookingEnabled,false);
assert.equal(r.review.serviceName,"Haircut");
assert.equal(r.review.staffName,"Sam");
assert.equal(r.review.startTime,"10:00");
assert.equal(r.review.endTime,"10:30");
assert.equal(r.review.durationLabel,"30 min");
assert.equal(r.review.totalLabel,"£20.50");
assert.equal(r.review.totalPence,2050);
assert.ok(Object.isFrozen(r.review));
assert.equal("clients" in r.review,false);
assert.equal("ownerUid" in r.review,false);
assert.equal("customerEmail" in r.review,false);
for(const args of [
 [sample(),"2026-11-20","11:00",slots(),"sam"],
 [sample(),"2026-11-20","12:00",slots(),"sam"],
 [sample(),"2026-02-30","10:00",slots(),"sam"],
 [sample(),"2026-11-20","10:00",slots(),"unknown"],
 [{...sample(),published:false},"2026-11-20","10:00",slots(),"sam"]
])assert.equal(review(...args).status,"REVIEW_UNAVAILABLE");
const late=sample();late.services[0].durationMinutes=60;
assert.equal(review(late,"2026-11-20","23:30",[{date:"2026-11-20",time:"23:30",staffId:"sam",serviceId:"cut",available:true}]).reason,"appointment_exceeds_day");
const source=fs.readFileSync("web/phase1284/bookingReview.js","utf8");
for(const forbidden of ["fetch(","XMLHttpRequest","localStorage","sessionStorage","indexedDB","firebase.","WebSocket("])assert.ok(!source.includes(forbidden),forbidden);
console.log("PASS Phase 12.84 booking review preview and privacy safety");
