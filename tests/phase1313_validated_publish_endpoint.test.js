"use strict";
const assert=require("node:assert/strict");
const {createValidatedPublishEndpoint}=require("../backend/phase1313/validatedPublishEndpoint");
const origin="https://boustio.co.uk";
function fixture(){
 const writes=[];let authCalls=0;
 const db={collection(name){return {doc(id){return {path:name+"/"+id};}};},async runTransaction(fn){return fn({
 async get(ref){const data=ref.path==="publicBusinesses/owner_1"?{published:true,slug:"kody-blends"}:null;return {exists:!!data,data:()=>data};},
 create(ref,data){writes.push({path:ref.path,data});},set(ref,data){writes.push({path:ref.path,data});}});}};
 const auth={async verifyIdToken(_,revoked){authCalls++;assert.equal(revoked,true);return {uid:"owner_1",email_verified:true};}};
 return {handle:createValidatedPublishEndpoint(db,auth,{allowedOrigins:[origin]}),writes,get authCalls(){return authCalls;}};
}
(async()=>{
const req={method:"POST",headers:{origin,"content-type":"application/json",authorization:"Bearer "+"x".repeat(30)},body:{slug:"kody-blends"}};
let f=fixture();let r=await f.handle(req);
assert.equal(r.status,200);assert.equal(r.body.status,"MAPPED");assert.equal(f.authCalls,1);assert.equal(f.writes[0].data.businessId,"owner_1");
const cases=[
 [{...req,method:"GET"},405],
 [{...req,headers:{...req.headers,origin:"https://evil.example"}},403],
 [{...req,headers:{...req.headers,origin:undefined}},403],
 [{...req,headers:{...req.headers,"content-type":"text/plain"}},415],
 [{...req,headers:{...req.headers,"content-type":"application/json; charset=iso-8859-1"}},415],
 [{...req,body:{slug:"kody-blends",businessId:"attacker"}},400],
 [{...req,body:{slug:"../admin"}},400],
 [{...req,body:null},400],
 [{...req,body:["kody-blends"]},400]
];
for(const [bad,expected] of cases){f=fixture();r=await f.handle(bad);assert.equal(r.status,expected);assert.equal(f.authCalls,0);assert.equal(f.writes.length,0);assert.equal(r.headers["cache-control"],"no-store");}
assert.throws(()=>createValidatedPublishEndpoint({}, {},{}),TypeError);
assert.throws(()=>createValidatedPublishEndpoint({}, {},{allowedOrigins:["http://boustio.co.uk"]}),TypeError);
console.log("PASS Phase 13.13 origin, JSON and strict request validation");
})().catch(e=>{console.error(e);process.exitCode=1});
