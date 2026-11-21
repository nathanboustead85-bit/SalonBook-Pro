"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const {adaptDashboardSnapshot:adapt,loading}=require("../web/phase33/dashboard-adapter-33-1");
const NOW=1800000000000;
const good=()=>({auth:{uid:"owner",emailVerified:true},business:{businessId:"owner",name:"Kody Blends",acceptingBookings:false},expiresAt:NOW+1000,revision:3,servicesOwnerId:"owner",servicesRevision:3,services:{schemaVersion:1,json:JSON.stringify([{id:"cut",name:"Haircut",pricePence:2000,durationMinutes:30,active:true}])}});
const options={ownerId:"owner",now:NOW};
test("loading state fails closed",()=>{assert.equal(loading().status,"LOADING");assert.equal(loading().bookingEnabled,false);assert.equal(adapt(null,options).status,"LOADING")});
test("valid owner snapshot produces immutable read-only display",()=>{const x=adapt(good(),options);assert.equal(x.status,"READ_ONLY_READY");assert.equal(x.editingEnabled,false);assert.equal(x.bookingEnabled,false);assert.equal(x.services[0].pricePence,2000);assert(Object.isFrozen(x));assert(Object.isFrozen(x.services[0]))});
for(const [name,change,reason] of [
 ["source error",x=>x.error="offline","source_error"],
 ["wrong user",x=>x.auth.uid="other","unauthorised_owner"],
 ["unverified user",x=>x.auth.emailVerified=false,"unauthorised_owner"],
 ["missing auth",x=>delete x.auth,"unauthorised_owner"],
 ["wrong business",x=>x.business.businessId="other","invalid_business"],
 ["bookings enabled",x=>x.business.acceptingBookings=true,"invalid_business"],
 ["missing business",x=>delete x.business,"invalid_business"],
 ["stale snapshot",x=>x.expiresAt=NOW-1,"stale_or_invalid_snapshot"],
 ["invalid revision",x=>x.revision=-1,"stale_or_invalid_snapshot"],
 ["cross-owner services",x=>x.servicesOwnerId="other","mixed_owner_or_revision"],
 ["stale services",x=>x.servicesRevision=2,"mixed_owner_or_revision"],
 ["malformed JSON",x=>x.services.json="{","invalid_service_content"],
 ["invalid price",x=>x.services.json=JSON.stringify([{id:"cut",name:"Haircut",pricePence:-5,durationMinutes:30,active:true}]),"invalid_service_content"],
 ["invalid duration",x=>x.services.json=JSON.stringify([{id:"cut",name:"Haircut",pricePence:2000,durationMinutes:999,active:true}]),"invalid_service_content"]
])test(name+" returns unavailable",()=>{const x=good();change(x);const y=adapt(x,options);assert.equal(y.status,"UNAVAILABLE");assert.equal(y.reason,reason);assert.equal(y.bookingEnabled,false);assert.deepEqual(y.services,[])});
test("invalid caller context denied",()=>assert.equal(adapt(good(),{ownerId:"owner",now:NaN}).status,"UNAVAILABLE"));
test("original input remains untouched",()=>{const x=good(),before=JSON.stringify(x);adapt(x,options);assert.equal(JSON.stringify(x),before)});
test("no external APIs or live actions",()=>{const s=fs.readFileSync(require.resolve("../web/phase33/dashboard-adapter-33-1"),"utf8");assert.doesNotMatch(s,/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|\.setDoc\s*\(|\.updateDoc\s*\(|deploy\s*\(|stripe/i)});
