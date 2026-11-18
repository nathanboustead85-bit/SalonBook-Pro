"use strict";
const assert=require("node:assert/strict");
const {createGoogleServiceTokenVerifier}=require("../functions/phase17GoogleTokenVerifier");
const {authenticateService,EXPECTED_CALLER}=require("../functions/phase17ServiceIdentityBoundary");
const audience="https://boustio-public-writer-example.a.run.app";
const token="signed.header.payload";
const claims={iss:"https://accounts.google.com",aud:audience,email:EXPECTED_CALLER,
 email_verified:true,sub:"123456789",exp:Math.floor(Date.now()/1000)+3600};
(async()=>{
 let count=0;
 const client={verifyIdToken:async options=>{
  count++;assert.deepEqual(options,{idToken:token,audience});return {getPayload:()=>claims};
 }};
 const verifyIdToken=createGoogleServiceTokenVerifier({expectedAudience:audience,client});
 assert.equal((await authenticateService({authorization:"Bearer "+token,audience,verifyIdToken})).serviceAccount,EXPECTED_CALLER);
 assert.equal(count,1);
 await assert.rejects(()=>verifyIdToken(token,"https://other.example.com"),/AUDIENCE_CONFIGURATION_MISMATCH/);
 assert.equal(count,1);
 await assert.rejects(()=>verifyIdToken("bad",audience),/INVALID_SERVICE_TOKEN/);
 assert.equal(count,1);
 assert.throws(()=>createGoogleServiceTokenVerifier({expectedAudience:"(default)",client}),/INVALID_CONFIGURED_AUDIENCE/);
 const rejecting=createGoogleServiceTokenVerifier({expectedAudience:audience,client:{
  verifyIdToken:async()=>{throw Error("INVALID_GOOGLE_SIGNATURE");}
 }});
 await assert.rejects(()=>authenticateService({authorization:"Bearer "+token,audience,verifyIdToken:rejecting}),/INVALID_GOOGLE_SIGNATURE/);
 const noPayload=createGoogleServiceTokenVerifier({expectedAudience:audience,client:{verifyIdToken:async()=>({getPayload:()=>null})}});
 await assert.rejects(()=>noPayload(token,audience),/MISSING_VERIFIED_TOKEN_PAYLOAD/);
 console.log("PASS PHASE17_GOOGLE_TOKEN_VERIFIER: Google library adapter, fixed audience, fail-closed verification");
 console.log("OFFLINE_MOCKED_GOOGLE_CLIENT_NO_CLOUD_AUTH_NO_DEPLOYMENT_NO_FIRESTORE_WRITES");
})().catch(e=>{console.error(e);process.exitCode=1;});
