"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const {createAdminFirestoreLookup,createFirebaseSlugLookupHandler}=require("../backend/phase138/firebaseAdminSlugLookup");
function fakeDb(mapping,business){
 const reads=[];
 const db={collection(name){assert.ok(["publicSlugMappings","publicBusinesses"].includes(name));return {doc(id){reads.push(name+"/"+id);return {async get(){const value=name==="publicSlugMappings"?mapping:business;return {exists:value!==null,data:()=>value};}};}};}};
 return {db,reads};
}
(async()=>{
const mapping={slug:"kody-blends",businessId:"owner_uid_123",published:true,secret:"private"};
const business={slug:"kody-blends",published:true,businessName:"Kody Blends",clients:[{email:"private@example.test"}]};
const {db,reads}=fakeDb(mapping,business);
const lookup=createAdminFirestoreLookup(db);
assert.deepEqual(await lookup("kody-blends"),{slug:"kody-blends",businessId:"owner_uid_123",published:true});
assert.deepEqual(reads,["publicSlugMappings/kody-blends","publicBusinesses/owner_uid_123"]);
const response=await createFirebaseSlugLookupHandler(db)({method:"GET",url:"https://boustio.co.uk/api/public-business-id?business=kody-blends"});
assert.equal(response.status,200);assert.equal(response.body.businessId,"owner_uid_123");assert.ok(!JSON.stringify(response).includes("private@example.test"));
assert.equal((await lookup("../admin")),null);assert.equal(reads.length,4);
for(const [m,b] of [[null,business],[{...mapping,published:false},business],[{...mapping,businessId:"../private"},business],[mapping,null],[mapping,{...business,published:false}],[mapping,{...business,slug:"other"}]]){
 const x=fakeDb(m,b);assert.equal(await createAdminFirestoreLookup(x.db)("kody-blends"),null);
}
const failed=fakeDb(mapping,business);
failed.db.collection=()=>({doc:()=>({get:async()=>{throw Error("denied")}})});
assert.equal((await createFirebaseSlugLookupHandler(failed.db)({method:"GET",url:"https://boustio.co.uk/?business=kody-blends"})).status,503);
assert.throws(()=>createAdminFirestoreLookup(null),TypeError);
const source=fs.readFileSync("backend/phase138/firebaseAdminSlugLookup.js","utf8");
for(const forbidden of [".where(",".getDocs(",".add(",".set(",".update(",".delete(",".listDocuments("])assert.ok(!source.includes(forbidden),forbidden);
const rules=fs.readFileSync("firestore.rules","utf8");
assert.ok(!rules.includes("match /publicSlugMappings/"));assert.match(rules,/match \/\{document=\*\*\}/);
console.log("PASS Phase 13.8 Firebase Admin exact-read mapping and published-record validation");
})().catch(e=>{console.error(e);process.exitCode=1});
