"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const {createAuthorizedPublishMapping}=require("../backend/phase1310/authorizedPublishMapping");
function fixture(business,mapping){
 const writes=[],reads=[];
 const db={collection(name){assert.ok(["publicBusinesses","publicSlugMappings"].includes(name));return {doc(id){return {path:name+"/"+id};}};},
 async runTransaction(fn){return fn({async get(ref){reads.push(ref.path);const data=ref.path==="publicBusinesses/owner_1"?business:ref.path==="publicSlugMappings/kody-blends"?mapping:null;return {exists:data!==null,data:()=>data};},create(ref,data){writes.push({type:"create",path:ref.path,data});},set(ref,data){writes.push({type:"set",path:ref.path,data});}});}};
 return {db,writes,reads};
}
(async()=>{
const identity={uid:"owner_1",emailVerified:true};
const published={slug:"kody-blends",published:true,businessName:"Kody Blends"};
let f=fixture(published,null);
assert.equal((await createAuthorizedPublishMapping(f.db)({identity,slug:"kody-blends",businessId:"attacker"})).status,"MAPPED");
assert.deepEqual(f.reads,["publicBusinesses/owner_1","publicSlugMappings/kody-blends"]);
assert.deepEqual(f.writes,[{type:"create",path:"publicSlugMappings/kody-blends",data:{slug:"kody-blends",businessId:"owner_1",published:true}}]);
for(const bad of [null,{}, {uid:"owner_1",emailVerified:false},{uid:"../admin",emailVerified:true}]){
 f=fixture(published,null);assert.equal((await createAuthorizedPublishMapping(f.db)({identity:bad,slug:"kody-blends"})).status,"UNAUTHORIZED");assert.equal(f.reads.length,0);
}
f=fixture(published,null);assert.equal((await createAuthorizedPublishMapping(f.db)({identity,slug:"../private"})).status,"INVALID_SLUG");assert.equal(f.reads.length,0);
f=fixture({...published,published:false},null);assert.equal((await createAuthorizedPublishMapping(f.db)({identity,slug:"kody-blends"})).status,"NOT_PUBLISHED");assert.equal(f.writes.length,0);
f=fixture(published,{slug:"kody-blends",businessId:"other_owner",published:true});assert.equal((await createAuthorizedPublishMapping(f.db)({identity,slug:"kody-blends"})).status,"SLUG_TAKEN");assert.equal(f.writes.length,0);
const source=fs.readFileSync("backend/phase1310/authorizedPublishMapping.js","utf8");
assert.ok(!source.includes("request.body.businessId"));assert.ok(!source.includes("allow write: if true"));
console.log("PASS Phase 13.10 verified owner mapping integration and spoofing protections");
})().catch(e=>{console.error(e);process.exitCode=1});
