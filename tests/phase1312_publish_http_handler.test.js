"use strict";
const assert=require("node:assert/strict");
const {createPublishLinkHttpHandler}=require("../backend/phase1312/publishLinkHttpHandler");
const token="Bearer "+"x".repeat(30);
function fixture(published=true,mapping=null,validToken=true){
 const writes=[];
 const db={collection(name){return {doc(id){return {path:name+"/"+id};}};},async runTransaction(fn){return fn({
 async get(ref){const data=ref.path==="publicBusinesses/owner_1"?{published,slug:"kody-blends"}:mapping;return {exists:data!==null,data:()=>data};},
 create(ref,data){writes.push({path:ref.path,data});},set(ref,data){writes.push({path:ref.path,data});}});}};
 const auth={async verifyIdToken(_token,revoked){assert.equal(revoked,true);if(!validToken)throw Error("expired secret");return {uid:"owner_1",email_verified:true};}};
 return {handler:createPublishLinkHttpHandler(db,auth),writes};
}
(async()=>{
const req={method:"POST",headers:{authorization:token},body:{slug:"kody-blends",businessId:"attacker"}};
let f=fixture();let r=await f.handler(req);
assert.equal(r.status,200);assert.deepEqual(r.body,{status:"MAPPED"});assert.equal(r.headers["cache-control"],"no-store");
assert.equal(f.writes[0].data.businessId,"owner_1");
f=fixture(true,{slug:"kody-blends",businessId:"owner_1",published:true});r=await f.handler(req);assert.equal(r.status,200);assert.equal(r.body.status,"ALREADY_MAPPED");assert.equal(f.writes.length,0);
f=fixture(false);r=await f.handler(req);assert.equal(r.status,409);assert.equal(r.body.status,"NOT_PUBLISHED");
f=fixture(true,{slug:"kody-blends",businessId:"another_owner",published:true});r=await f.handler(req);assert.equal(r.status,409);assert.equal(r.body.status,"SLUG_TAKEN");
f=fixture();r=await f.handler({...req,method:"GET"});assert.equal(r.status,405);assert.equal(f.writes.length,0);
f=fixture();r=await f.handler({...req,body:{slug:"../private"}});assert.equal(r.status,400);assert.equal(f.writes.length,0);
f=fixture();r=await f.handler({...req,headers:{}});assert.equal(r.status,401);assert.equal(f.writes.length,0);
f=fixture(true,null,false);r=await f.handler(req);assert.equal(r.status,401);assert.ok(!JSON.stringify(r).includes("secret"));assert.equal(f.writes.length,0);
f=fixture();r=await f.handler({...req,body:null});assert.equal(r.status,400);
console.log("PASS Phase 13.12 publishing HTTP status, owner security and fail-closed response checks");
})().catch(e=>{console.error(e);process.exitCode=1});
