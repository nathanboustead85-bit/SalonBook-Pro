"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {preparePublicListing}=require("../functions/phase17PublicListingProjection");
const uid="owner_123";
const profile={businessId:uid,name:" Demo Salon ",slug:"demo-salon",category:"Hair",
  phone:"",address:"",description:"",privateNotes:"DO NOT PUBLISH",
  appointments:[{customer:"PRIVATE"}],backups:{secret:"PRIVATE"},clientProfiles:[{name:"PRIVATE"}]};
const listing=preparePublicListing(uid,profile);
assert.deepEqual(Object.keys(listing).sort(),[
 "acceptingBookings","address","businessId","category","description","name",
 "phone","published","schemaVersion","slug"].sort());
assert.equal(listing.name,"Demo Salon");
assert.equal(listing.acceptingBookings,false);
assert.equal(JSON.stringify(listing).includes("PRIVATE"),false);
assert.equal(JSON.stringify(listing).includes("DO NOT PUBLISH"),false);
assert.ok(Object.isFrozen(listing));
for(const invalid of [
 {...profile,businessId:"another_owner"},
 {...profile,slug:"../bookings"},
 {...profile,slug:"Bad Slug"},
 {...profile,name:""},
 {...profile,description:"x".repeat(2001)},
 {...profile,slug:"x".repeat(51)}
])assert.throws(()=>preparePublicListing(uid,invalid));
assert.throws(()=>preparePublicListing("bad/owner",profile));
assert.throws(()=>preparePublicListing(uid,null));
const src=fs.readFileSync(path.join(__dirname,"../functions/phase17PublicListingProjection.js"),"utf8");
assert.doesNotMatch(src,/firebase-admin|firebase-functions|runTransaction|\.collection\(|getFirestore\(/);
console.log("PASS PHASE17_PUBLIC_LISTING_PROJECTION: private fields excluded, ownership data checked, bookings disabled");
console.log("OFFLINE_ONLY_NO_DATABASE_CREATION_NO_DEPLOYMENT_NO_FIRESTORE_WRITES");
