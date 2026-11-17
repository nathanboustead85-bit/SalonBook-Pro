"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../functions/index.js"),"utf8");
const mapping=fs.readFileSync(path.join(__dirname,"../functions/phase1317PublicSlugMapping.js"),"utf8");
const start=source.indexOf("exports.publishBusiness = onCall(");
const end=source.indexOf("exports.unpublishBusiness = onCall(",start);
assert.ok(start>=0&&end>start,"publishBusiness function present");
const publish=source.slice(start,end);
const required=[
 ["verified owner", "const uid = verifiedUser(request)"],
 ["private profile path", '.collection("business")'],
 ["private profile ID", '.doc("profile")'],
 ["public profile path", '.collection("publicBusinesses")'],
 ["private profile read", "transaction.get(profileRef)"],
 ["profile validation", "validateProfile(profile, uid)"],
 ["slug uniqueness check", "slugSnapshot.get(\"businessId\") !== uid"],
 ["mapping validation", "preparePublicSlugMapping(db, transaction"],
 ["public profile write", "transaction.set(\n          publicRef,"],
 ["bookings disabled", "acceptingBookings: false"],
 ["published flag", "published: true"],
 ["transaction", "db.runTransaction("]
];
for(const [name,fragment] of required)assert.ok(publish.includes(fragment),"missing "+name);
assert.ok(publish.indexOf("validateProfile(profile, uid)")<publish.indexOf("transaction.set(\n          publicRef,"),"validate before publish");
assert.ok(publish.indexOf("preparePublicSlugMapping(db, transaction")<publish.indexOf("publicMapping.apply()"),"mapping checked before applied");
assert.ok(mapping.includes('tx.get(mappingRef)')&&mapping.includes('status:"SLUG_TAKEN"'),"slug conflict guarded");
assert.ok(!publish.includes("acceptingBookings: true"),"live booking gate remains off");
console.log("PASS Phase 17.18 publishing contract: verified owner, profile validation, slug collision guard, atomic mapping, bookings disabled");
console.log("Phase 17.18: SOURCE_AUDIT_ONLY; NO_FIRESTORE_ACCESS; NO_DEPLOYMENT");
