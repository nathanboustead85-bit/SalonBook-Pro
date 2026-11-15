"use strict";
const assert=require("node:assert/strict");
const {createBoundedPublishEndpoint,MAX_BODY_BYTES}=require("../backend/phase1314/boundedPublishEndpoint");
const origin="https://boustio.co.uk";
function fixture(){
 let authCalls=0;const writes=[];
 const db={collection(name){return {doc(id){return {path:name+"/"+id};}};},async runTransaction(fn){return fn({
 async get(ref){const data=ref.path==="publicBusinesses/owner_1"?{published:true,slug:"kody-blends"}:null;return {exists:!!data,data:()=>data};},
 create(ref,data){writes.push({ref:ref.path,data});},set(ref,data){writes.push({ref:ref.path,data});}});}};
 const auth={async verifyIdToken(_,revoked){authCalls++;assert.equal(revoked,true);return {uid:"owner_1",email_verified:true};}};
 return {handle:createBoundedPublishEndpoint(db,auth,{allowedOrigins:[origin]}),writes,get authCalls(){return authCalls;}};
}
(async()=>{
 const raw=Buffer.from('{"slug":"kody-blends"}');
 const req={method:"POST",headers:{origin,"content-type":"application/json",authorization:"Bearer "+"x".repeat(30),"content-length":String(raw.length)},rawBody:raw};
 let f=fixture();let r=await f.handle(req);
 assert.equal(r.status,200);assert.equal(r.body.status,"MAPPED");assert.equal(f.authCalls,1);assert.equal(f.writes[0].data.businessId,"owner_1");
 const cases=[
 [{...req,rawBody:Buffer.alloc(MAX_BODY_BYTES+1),headers:{...req.headers,"content-length":String(MAX_BODY_BYTES+1)}},413],
 [{...req,rawBody:Buffer.alloc(MAX_BODY_BYTES+1),headers:{...req.headers,"content-length":undefined}},413],
 [{...req,headers:{...req.headers,"content-length":"1"}},400],
 [{...req,headers:{...req.headers,"content-length":"-1"}},400],
 [{...req,headers:{...req.headers,"content-length":"1e9"}},400],
 [{...req,rawBody:Buffer.from("{bad"),headers:{...req.headers,"content-length":undefined}},400],
 [{...req,rawBody:Buffer.from([0xff]),headers:{...req.headers,"content-length":undefined}},400],
 [{...req,rawBody:undefined,headers:{...req.headers,"content-length":undefined}},400],
 [{...req,rawBody:Buffer.from('{"slug":"kody-blends","uid":"attacker"}'),headers:{...req.headers,"content-length":undefined}},400],
 [{...req,method:"GET"},405]
 ];
 for(const [bad,expected] of cases){f=fixture();r=await f.handle(bad);assert.equal(r.status,expected,JSON.stringify(r));assert.equal(f.authCalls,0);assert.equal(f.writes.length,0);assert.equal(r.headers["cache-control"],"no-store");}
 console.log("PASS Phase 13.14 raw byte cap, length mismatch, UTF-8, JSON and owner safeguards");
})().catch(e=>{console.error(e);process.exitCode=1});
