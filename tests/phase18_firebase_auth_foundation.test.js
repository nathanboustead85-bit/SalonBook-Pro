"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.join(__dirname,"..");
const source=fs.readFileSync(path.join(root,"website/business/register/firebase-auth-foundation.mjs"),"utf8");
const html=fs.readFileSync(path.join(root,"website/business/register/index.html"),"utf8");
const rules=fs.readFileSync(path.join(root,"firestore.rules"),"utf8");
const load=()=>import(pathToFileURL(path.join(root,"website/business/register/firebase-auth-foundation.mjs")).href);
test("Phase 18.2 Firebase registration and email verification are safely disabled",async t=>{
 const m=await load();
 await t.test("Registration and customer bookings are off",()=>{
  assert.equal(m.PUBLIC_REGISTRATION_ENABLED,false);
  assert.equal(m.CUSTOMER_BOOKINGS_ENABLED,false);
  assert.match(html,/<button[^>]*type="button" disabled/);
  assert.doesNotMatch(html,/firebase-auth-foundation\.mjs/);
  assert.doesNotMatch(source,/import\s+[^;]*firebase\/auth/);
 });
 await t.test("Disabled registration cannot call injected Firebase SDK",async()=>{
  let calls=0;
  const sdk={createUserWithEmailAndPassword:async()=>{calls++;return {user:{uid:"owner"}};},sendEmailVerification:async()=>{calls++;}};
  await assert.rejects(m.registerBusinessAccount({email:"owner@example.com",password:"secure-password-123",auth:{},sdk}),/not enabled/);
  assert.equal(calls,0);
 });
 await t.test("Disabled sign-in cannot call Firebase SDK",async()=>{
  let calls=0;
  const sdk={signInWithEmailAndPassword:async()=>{calls++;return {user:{uid:"owner",emailVerified:true}};}};
  await assert.rejects(m.signInVerifiedBusiness({email:"owner@example.com",password:"secure-password-123",auth:{},sdk}),/not enabled/);
  assert.equal(calls,0);
 });
 await t.test("Credentials and verified-owner rules fail closed",()=>{
  assert.equal(m.validateCredentials(" OWNER@Example.COM ","secure-password-123").email,"owner@example.com");
  for(const email of ["not-email","", "a@b"])assert.throws(()=>m.validateCredentials(email,"secure-password-123"));
  for(const password of ["short",""])assert.throws(()=>m.validateCredentials("owner@example.com",password));
  assert.throws(()=>m.requireVerifiedOwner({uid:"owner",emailVerified:false}),/Verified/);
  assert.throws(()=>m.requireVerifiedOwner(null),/Verified/);
  assert.equal(m.requireVerifiedOwner({uid:"owner",emailVerified:true}),"owner");
  assert.match(rules,/function isVerifiedOwner\(userId\)/);
  assert.match(rules,/request\.auth\.token\.email_verified == true/);
  assert.match(rules,/request\.resource\.data\.acceptingBookings == false/);
 });
});
