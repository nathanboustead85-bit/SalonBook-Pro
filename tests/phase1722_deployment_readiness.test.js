"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const firebase=JSON.parse(read("firebase.json"));
const rc=JSON.parse(read(".firebaserc"));
const pkg=JSON.parse(read("functions/package.json"));
const index=read("functions/index.js");
const mapping=read("functions/phase1317PublicSlugMapping.js");
assert.equal(rc.projects.production,"salonbook-pro-ad5ff");
assert.equal(rc.projects.default,"salonbook-pro-ad5ff");
assert.equal(firebase.functions.source,"functions");
assert.equal(firebase.functions.runtime,"nodejs22");
assert.equal(pkg.engines.node,"22");
assert.ok(pkg.dependencies["firebase-admin"]&&pkg.dependencies["firebase-functions"]);
const start=index.indexOf("exports.publishBusiness = onCall(");
const end=index.indexOf("exports.unpublishBusiness = onCall(",start);
assert.ok(start>=0&&end>start);
const publish=index.slice(start,end);
for(const token of [
 'region: "europe-west2"',
 "verifiedUser(request)",
 'email_verified !== true',
 'collection("publicBusinesses")',
 'collection("businessSlugs")',
 'collection("business")',
 'doc("profile")',
 "validateProfile(profile, uid)",
 "preparePublicSlugMapping(db, transaction",
 "transaction.set(\n          publicRef,",
 "acceptingBookings: false",
 "published: true"
])assert.ok((token==="email_verified !== true"?index:publish).includes(token),"Missing safeguard: "+token);
assert.ok(mapping.includes('status:"SLUG_TAKEN"'));
assert.ok(publish.indexOf("validateProfile(profile, uid)")<publish.indexOf("transaction.set(\n          publicRef,"));
assert.ok(firebase.hosting.rewrites.some(r=>r.function&&r.function.functionId==="getPublicBusinessProfile"),"Existing hosting API must be preserved");
assert.ok(index.includes("exports.getPublicBusinessProfile"),"Existing public API function must be preserved");
console.log("PASS Phase 17.22 project, runtime, publishing ownership, slug and booking-disable guards");
console.log("Phase 17.22: PLAN_ONLY; NO_DEPLOYMENT; NO_FIRESTORE_ACCESS");
