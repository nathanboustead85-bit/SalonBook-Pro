"use strict";
const assert=require("node:assert/strict");
const {fullPrecisionRevision,compareRevisions}=require("../functions/phase17FullPrecisionRevision");
const snap=n=>({exists:true,updateTime:{seconds:1763450000,nanoseconds:n}});
const a=fullPrecisionRevision(snap(1000001)),b=fullPrecisionRevision(snap(1000002));
assert.notEqual(a,b);assert.equal(compareRevisions(a,b),-1);assert.equal(compareRevisions(b,a),1);assert.equal(compareRevisions(a,a),0);
assert.ok(fullPrecisionRevision(snap(999999999))>fullPrecisionRevision(snap(1000001)));
for(const bad of [null,{exists:false,updateTime:{seconds:1,nanoseconds:0}},snap(-1),snap(1000000000)])
 assert.throws(()=>fullPrecisionRevision(bad));
assert.throws(()=>compareRevisions("1","2"));
console.log("PASS PHASE17_FULL_PRECISION_REVISION: distinct nanoseconds, deterministic order, malformed timestamp rejected");
console.log("OFFLINE_ONLY_NO_FIREBASE_CONNECTION_NO_DEPLOYMENT");
