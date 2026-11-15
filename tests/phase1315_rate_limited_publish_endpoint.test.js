"use strict";
const assert=require("node:assert/strict");
const {createRateLimitedPublishEndpoint}=require("../backend/phase1315/rateLimitedPublishEndpoint");
const origin="https://boustio.co.uk";
function fixture(limiter){
 const writes=[];let authCalls=0;
 const db={collection(name){return {doc(id){return {path:name+"/"+id};}};},async runTransaction(fn){return fn({
 async get(ref){const data=ref.path==="publicBusinesses/owner_1"?{published:true,slug:"kody-blends"}:null;return {exists:!!data,data:()=>data};},
 create(ref,data){writes.push({ref:ref.path,data});},set(ref,data){writes.push({ref:ref.path,data});}});}};
 const auth={async verifyIdToken(_,revoked){authCalls++;assert.equal(revoked,true);return {uid:"owner_1",email_verified:true};}};
 return {handle:createRateLimitedPublishEndpoint(db,auth,{allowedOrigins:[origin]},{limiter}),writes,get authCalls(){return authCalls;}};
}
(async()=>{
 const raw=Buffer.from('{"slug":"kody-blends"}');
 const request={method:"POST",headers:{origin,"content-type":"application/json",authorization:"Bearer "+"x".repeat(30)},rawBody:raw};
 const ctx={trustedRateLimitKey:"gateway-client-123"};
 let keys=[];let f=fixture({async consume(key){keys.push(key);return {allowed:true};}});
 let r=await f.handle(request,ctx);assert.equal(r.status,200);assert.deepEqual(keys,["publish-link:gateway-client-123"]);assert.equal(f.writes.length,1);
 f=fixture({async consume(){return {allowed:false,retryAfterSeconds:60};}});
 r=await f.handle(request,ctx);assert.equal(r.status,429);assert.equal(r.headers["retry-after"],"60");assert.equal(f.authCalls,0);assert.equal(f.writes.length,0);
 f=fixture({async consume(){throw Error("database offline secret");}});
 r=await f.handle(request,ctx);assert.equal(r.status,503);assert.equal(r.body.status,"RATE_LIMIT_UNAVAILABLE");assert.ok(!JSON.stringify(r).includes("secret"));assert.equal(f.authCalls,0);
 f=fixture({async consume(){return {};}});r=await f.handle(request,ctx);assert.equal(r.status,503);assert.equal(f.writes.length,0);
 f=fixture({async consume(){throw Error("should not call");}});r=await f.handle(request,{});assert.equal(r.status,503);assert.equal(f.authCalls,0);
 f=fixture({async consume(){throw Error("should not call");}});r=await f.handle({...request,method:"GET"},ctx);assert.equal(r.status,405);
 assert.throws(()=>createRateLimitedPublishEndpoint({}, {},{allowedOrigins:[origin]},{}),TypeError);
 console.log("PASS Phase 13.15 atomic limiter integration, fail-closed outages and 429 handling");
})().catch(e=>{console.error(e);process.exitCode=1});
