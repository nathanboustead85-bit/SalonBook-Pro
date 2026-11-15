"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const {createSlugLookupHandler}=require("../backend/phase137/publicSlugLookupHandler");
(async()=>{
let calls=0;
const handler=createSlugLookupHandler(async slug=>{calls++;return {slug,businessId:"owner_uid_123",published:true,ownerEmail:"private@example.test",clients:["secret"]};});
const request=(business,method="GET")=>({method,url:"https://boustio.co.uk/api/public-business-id?business="+business});
const ok=await handler(request("kody-blends"));
assert.equal(ok.status,200);assert.deepEqual(ok.body,{status:"FOUND",slug:"kody-blends",businessId:"owner_uid_123",published:true});
assert.ok(!JSON.stringify(ok).includes("private@example.test"));assert.equal(ok.headers["cache-control"],"no-store");
for(const bad of ["../admin","%3Cscript%3E","","UPPER","kody-blends&business=other"]){const r=await handler(request(bad));assert.equal(r.status,400);assert.equal(r.body.status,"INVALID_BUSINESS");}
assert.equal(calls,1);
assert.equal((await handler(request("kody-blends","POST"))).status,405);assert.equal(calls,1);
assert.equal((await createSlugLookupHandler(async()=>null)(request("kody-blends"))).status,404);
assert.equal((await createSlugLookupHandler(async()=>({slug:"other",businessId:"owner_uid_123",published:true}))(request("kody-blends"))).status,404);
assert.equal((await createSlugLookupHandler(async()=>({slug:"kody-blends",businessId:"owner_uid_123",published:false}))(request("kody-blends"))).status,404);
assert.equal((await createSlugLookupHandler(async()=>({slug:"kody-blends",businessId:"../private",published:true}))(request("kody-blends"))).status,404);
assert.equal((await createSlugLookupHandler(async()=>{throw Error("private failure detail")})(request("kody-blends"))).status,503);
assert.throws(()=>createSlugLookupHandler(null),TypeError);
const source=fs.readFileSync("backend/phase137/publicSlugLookupHandler.js","utf8");
for(const bad of ["getDocs(","where(","collection(","setDoc(","addDoc(","updateDoc(","deleteDoc("])assert.ok(!source.includes(bad),bad);
console.log("PASS Phase 13.7 trusted HTTP slug lookup and fail-closed privacy tests");
})().catch(e=>{console.error(e);process.exitCode=1});
