"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../functions/index.js"), "utf8");
const mapping = fs.readFileSync(path.join(__dirname, "../functions/phase1317PublicSlugMapping.js"), "utf8");
const runtime = 'serviceAccount: "boustio-business-publisher@salonbook-pro-ad5ff.iam.gserviceaccount.com"';
function section(name, endMarker) {
 const start = source.indexOf("exports." + name + " = onCall(");
 const end = source.indexOf(endMarker, start);
 assert.ok(start >= 0 && end > start, name + " source section must exist");
 return source.slice(start, end);
}
const publish = section("publishBusiness", "exports.unpublishBusiness = onCall(");
const unpublish = section("unpublishBusiness", "function requireChatEnabled()");
for (const [name, body] of [["publishBusiness", publish], ["unpublishBusiness", unpublish]]) {
 assert.ok(body.includes(runtime), name + " must use dedicated publisher identity");
 assert.ok(body.includes("verifiedUser(request)"), name + " must require verified owner");
 assert.ok(body.includes("db.runTransaction("), name + " must use transaction");
 assert.ok(body.includes("acceptingBookings: false"), name + " must disable customer bookings");
 assert.ok(!/acceptingBookings:\s*true/.test(body), name + " must never enable bookings");
}
assert.ok(publish.includes("validateProfile(profile, uid)"), "publish must validate profile owner");
assert.ok(publish.includes("preparePublicSlugMapping(db, transaction"), "publish must reserve slug transactionally");
assert.ok(unpublish.includes("prepareUnpublishMapping(db, transaction"), "unpublish must update slug mapping transactionally");
assert.ok(mapping.includes("tx.get(mappingRef)"), "mapping must check reservation");
console.log("PASS BOUSTIO_PUBLICATION_SECURITY_GUARD");
console.log("NO_CLOUD_DEPLOYMENT_NO_FIRESTORE_WRITES");
