"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const {createSlugMappingProvisioner}=require("../backend/phase139/provisionPublicSlugMapping");
function fixture(business,mapping){
 const docs={"publicBusinesses/owner_1":business,"publicSlugMappings/kody-blends":mapping};
 const writes=[];const reads=[];
 const db={collection(col){assert.ok(["publicBusinesses","publicSlugMappings"].includes(col));return {doc(id){return {path:col+"/"+id};}};},
 async runTransaction(fn){
  const tx={async get(ref){reads.push(ref.path);const data=docs[ref.path];return {exists:data!==null&&data!==undefined,data:()=>data};},
   create(ref,data){writes.push({op:"create",path:ref.path,data});},
   set(ref,data){writes.push({op:"set",path:ref.path,data});}};
  return fn(tx);
 }};
 return {db,writes,reads};
}
(async()=>{
const good={slug:"kody-blends",published:true,businessName:"Kody Blends"};
const args={slug:"kody-blends",businessId:"owner_1"};
let f=fixture(good,null);
assert.deepEqual(await createSlugMappingProvisioner(f.db)(args),{status:"MAPPED"});
assert.deepEqual(f.reads,["publicBusinesses/owner_1","publicSlugMappings/kody-blends"]);
assert.deepEqual(f.writes,[{op:"create",path:"publicSlugMappings/kody-blends",data:{...args,published:true}}]);
f=fixture(good,{...args,published:true});
assert.equal((await createSlugMappingProvisioner(f.db)(args)).status,"ALREADY_MAPPED");assert.equal(f.writes.length,0);
f=fixture(good,{...args,published:false});
assert.equal((await createSlugMappingProvisioner(f.db)(args)).status,"MAPPED");assert.equal(f.writes[0].op,"set");
for(const business of [null,{...good,published:false},{...good,slug:"other"}]){
 f=fixture(business,null);assert.equal((await createSlugMappingProvisioner(f.db)(args)).status,"NOT_PUBLISHED");assert.equal(f.writes.length,0);
}
f=fixture(good,{slug:"kody-blends",businessId:"other_owner",published:true});
assert.equal((await createSlugMappingProvisioner(f.db)(args)).status,"SLUG_TAKEN");assert.equal(f.writes.length,0);
for(const bad of [{slug:"../admin",businessId:"owner_1"},{slug:"kody-blends",businessId:"../private"},{}]){
 f=fixture(good,null);await assert.rejects(()=>createSlugMappingProvisioner(f.db)(bad),TypeError);assert.equal(f.reads.length,0);
}
assert.throws(()=>createSlugMappingProvisioner(null),TypeError);
const source=fs.readFileSync("backend/phase139/provisionPublicSlugMapping.js","utf8");
assert.ok(!source.includes("getDocs("));assert.ok(!source.includes("allow write: if true"));
const rules=fs.readFileSync("firestore.rules","utf8");
assert.ok(!rules.includes("match /publicSlugMappings/"));assert.match(rules,/match \/\{document=\*\*\}/);
console.log("PASS Phase 13.9 transactional slug provisioning, collision and publication safeguards");
})().catch(e=>{console.error(e);process.exitCode=1});
