"use strict";
const assert=require("node:assert/strict");
const {adaptPublicBusiness,adaptIsolatedCatalogue}=require("../web/phase1239/catalogueAdapter");
const {SAMPLE,availableSlots}=require("../web/phase1238/availabilityPreview");
const doc={businessId:"test-owner",name:"Demo Salon",slug:"demo-salon",category:"barber",
 published:true,acceptingBookings:false,schemaVersion:1};
const p=adaptPublicBusiness(doc,"demo-salon");
assert.equal(p.status,"PROFILE_ONLY");assert.equal(p.bookingEnabled,false);
console.log("PASS actual publicBusinesses v1 profile mapped");
assert.deepEqual(p.services,[]);assert.equal(p.availabilityStatus,"NOT_PUBLISHED");
console.log("PASS real public profile does not imply published services");
for(const bad of [null,{}, {...doc,published:false},{...doc,acceptingBookings:true},
 {...doc,schemaVersion:2},{...doc,slug:"another-salon"},{...doc,name:""}]){
 assert.equal(adaptPublicBusiness(bad,"demo-salon").status,"NOT_AVAILABLE");
}
console.log("PASS missing, unpublished and mismatched profiles rejected");
for(const slug of ["","Demo-Salon","../demo","ab"]){
 assert.equal(adaptPublicBusiness(doc,slug).status,"NOT_AVAILABLE");
}
console.log("PASS invalid slugs rejected");
assert.equal(adaptIsolatedCatalogue(p,null,[],[]).status,"NOT_AVAILABLE");
console.log("PASS missing service snapshots fail closed");
const x=adaptIsolatedCatalogue(p,SAMPLE.services,SAMPLE.staff,SAMPLE.appointments);
assert.equal(x.status,"ISOLATED_SNAPSHOT");assert.equal(x.bookingEnabled,false);
assert.equal(x.services.length,2);assert.equal(x.staff.length,1);
console.log("PASS isolated service and staff fixture normalized");
assert.equal(availableSlots(x,{serviceId:"cut",staffId:"alex",date:"2026-11-20"}).includes("09:30"),false);
console.log("PASS isolated adapter feeds conflict-aware slot calculation");
assert.equal(adaptIsolatedCatalogue({status:"NOT_AVAILABLE"},[],[],[]).status,"NOT_AVAILABLE");
console.log("PASS invalid profile cannot expose fixture catalogue");
assert.equal(Object.isFrozen(p),true);assert.equal(Object.isFrozen(p.services),true);
console.log("PASS published profile result immutable");
