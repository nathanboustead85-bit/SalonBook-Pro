"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {verifyStagingAppCheck}=require("../functions/stagingAppCheckVerification");
const valid="staging-fake-token-for-injected-verifier";
const check=async opts=>assert.rejects(verifyStagingAppCheck(opts),e=>e.code==="permission-denied");
test("Disabled staging verification fails closed",async()=>{await check({token:valid,verifyToken:async()=>({appId:"test"})});});
test("Missing token is rejected without invoking verifier",async()=>{let calls=0;await check({enabled:true,verifyToken:async()=>{calls++;return {appId:"test"};}});assert.equal(calls,0);});
test("Malformed tokens are rejected",async()=>{for(const token of ["short","a b c","x".repeat(8193),42])await check({enabled:true,token,verifyToken:async()=>({appId:"test"})});});
test("No verifier fails closed",async()=>{await check({enabled:true,token:valid});});
test("Valid injected Admin SDK response passes only in staging mode",async()=>{let options;const result=await verifyStagingAppCheck({enabled:true,token:valid,verifyToken:async(_token,opts)=>{options=opts;return {appId:"1:123:web:abc",alreadyConsumed:false};}});assert.equal(result.verified,true);assert.equal(result.appId,"1:123:web:abc");assert.deepEqual(options,{consume:true});});
test("Invalid signature reported by verifier is rejected",async()=>{await check({enabled:true,token:valid,verifyToken:async()=>{throw Error("invalid signature");}});});
test("Expired token reported by verifier is rejected",async()=>{await check({enabled:true,token:valid,verifyToken:async()=>{throw Error("expired");}});});
test("Replay-consumed token is rejected",async()=>{await check({enabled:true,token:valid,verifyToken:async()=>({appId:"test",alreadyConsumed:true})});});
test("Missing verified app identity is rejected",async()=>{await check({enabled:true,token:valid,verifyToken:async()=>({alreadyConsumed:false})});});
test("Unexpected verifier errors do not leak details",async()=>{await assert.rejects(verifyStagingAppCheck({enabled:true,token:valid,verifyToken:async()=>{throw Error("secret internal details");}}),e=>e.message==="App Check verification failed.");});
test("Live callables and messaging flags are unchanged",()=>{
 const index=fs.readFileSync(path.resolve(__dirname,"../functions/index.js"),"utf8");
 for(const name of ["startCustomerChat","sendCustomerChatMessage","getCustomerChatMessages"]){
  const start=index.indexOf("exports."+name+" = onCall(");
  assert.ok(start>=0);
  assert.match(index.slice(start,start+180),/enforceAppCheck: false/);
 }
 assert.notEqual(process.env.BOUSTIO_CHAT_ENABLED,"true");
});
