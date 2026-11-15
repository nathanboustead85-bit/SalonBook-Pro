"use strict";
const assert=require("node:assert/strict");
const {createAuthenticatedPublishLink}=require("../backend/phase1311/authenticatedPublishLink");
const authHeader="Bearer "+"x".repeat(30);
function fixture(token={uid:"owner_1",email_verified:true},published=true){
 const writes=[],reads=[],verified=[];
 const db={collection(name){return {doc(id){return {path:name+"/"+id};}};},async runTransaction(fn){return fn({
 async get(ref){reads.push(ref.path);const value=ref.path==="publicBusinesses/owner_1"?{slug:"kody-blends",published}:null;return {exists:!!value,data:()=>value};},
 create(ref,data){writes.push({path:ref.path,data});},set(ref,data){writes.push({path:ref.path,data});}});}};
 const auth={async verifyIdToken(value,checkRevoked){verified.push({value,checkRevoked});if(token instanceof Error)throw token;return token;}};
 return {db,auth,writes,reads,verified};
}
(async()=>{
let f=fixture();
const request={method:"POST",headers:{authorization:authHeader},body:{slug:"kody-blends",businessId:"attacker",identity:{uid:"attacker",emailVerified:true}}};
assert.equal((await createAuthenticatedPublishLink(f.db,f.auth)(request)).status,"MAPPED");
assert.deepEqual(f.verified,[{value:"x".repeat(30),checkRevoked:true}]);
assert.deepEqual(f.writes,[{path:"publicSlugMappings/kody-blends",data:{slug:"kody-blends",businessId:"owner_1",published:true}}]);
for(const [changed,expected] of [[{...request,method:"GET"},"METHOD_NOT_ALLOWED"],[{...request,headers:{}},"UNAUTHORIZED"],[{...request,headers:{authorization:"Bearer bad"}},"UNAUTHORIZED"],[{...request,body:{slug:"../admin"}},"INVALID_SLUG"]]){
 f=fixture();assert.equal((await createAuthenticatedPublishLink(f.db,f.auth)(changed)).status,expected);assert.equal(f.verified.length,0);assert.equal(f.writes.length,0);
}
for(const token of [new Error("expired"),null,{uid:"owner_1",email_verified:false},{uid:"../admin",email_verified:true}]){
 f=fixture(token);assert.equal((await createAuthenticatedPublishLink(f.db,f.auth)(request)).status,"UNAUTHORIZED");assert.equal(f.writes.length,0);
}
f=fixture(undefined,false);assert.equal((await createAuthenticatedPublishLink(f.db,f.auth)(request)).status,"NOT_PUBLISHED");assert.equal(f.writes.length,0);
assert.throws(()=>createAuthenticatedPublishLink(f.db,null),TypeError);
console.log("PASS Phase 13.11 Firebase Admin token verification, revoked-token checks and owner spoofing guards");
})().catch(e=>{console.error(e);process.exitCode=1});
