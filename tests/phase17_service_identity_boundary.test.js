"use strict";
const assert=require("node:assert/strict");
const {EXPECTED_CALLER,authenticateService,acceptTrustedPublication}=require("../functions/phase17ServiceIdentityBoundary");
const audience="https://boustio-public-writer-example.a.run.app";
const claims={iss:"https://accounts.google.com",aud:audience,email:EXPECTED_CALLER,email_verified:true,sub:"123456789",exp:Math.floor(Date.now()/1000)+3600};
const authorization="Bearer header.payload.signature";
const verifier=async(token,aud)=>{assert.equal(token,"header.payload.signature");assert.equal(aud,audience);return claims;};
const base={authorization,audience,verifyIdToken:verifier};
(async()=>{
 assert.equal((await authenticateService(base)).serviceAccount,EXPECTED_CALLER);
 for(const patch of [{authorization:""},{authorization:"Basic abc"},{verifyIdToken:async()=>({...claims,email:"attacker@example.com"})},
 {verifyIdToken:async()=>({...claims,aud:"https://wrong.example.com"})},
 {verifyIdToken:async()=>({...claims,email_verified:false})},
 {verifyIdToken:async()=>({...claims,iss:"https://evil.example.com"})},
 {verifyIdToken:async()=>({...claims,exp:1})}])
  await assert.rejects(()=>authenticateService({...base,...patch}),/MISSING_SERVICE_ID_TOKEN|UNAUTHORISED_SERVICE_IDENTITY/);
 await assert.rejects(()=>authenticateService({...base,verifyIdToken:async()=>{throw Error("INVALID_SIGNATURE");}}),/INVALID_SIGNATURE/);
 let writes=0;
 const db={collection:c=>({doc:id=>({key:c+"/"+id})}),runTransaction:async fn=>{
  writes++;const tx={get:async()=>({exists:false,data:()=>null,get:()=>undefined}),set:()=>{},delete:()=>{}};
  return fn(tx);
 }};
 const profile={businessId:"owner_1",name:"Demo Salon",slug:"demo-salon",category:"Hair",phone:"",address:"",description:"",privateNotes:"SECRET"};
 const command={operation:"publish",uid:"owner_1",version:1,profile};
 const result=await acceptTrustedPublication({...base,publicDb:db,command});
 assert.equal(result.status,"PUBLISHED");
 assert.equal(writes,1);
 await assert.rejects(()=>acceptTrustedPublication({...base,publicDb:db,command,verifyIdToken:async()=>({...claims,email:"wrong@example.com"})}),/UNAUTHORISED_SERVICE_IDENTITY/);
 assert.equal(writes,1);
 await assert.rejects(()=>acceptTrustedPublication({...base,publicDb:db,command:{...command,profile:{...profile,businessId:"another"}}}),/INVALID_OWNER_PROFILE/);
 assert.equal(writes,1);
 console.log("PASS PHASE17_SERVICE_IDENTITY_BOUNDARY: audience, issuer, caller identity, expiry and invalid payload checks");
 console.log("OFFLINE_ONLY_NO_SERVICE_DEPLOYMENT_NO_IAM_CHANGES_NO_FIRESTORE_WRITES");
})().catch(e=>{console.error(e);process.exitCode=1;});
