"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const rules=read("firestore.rules"),backend=read("functions/index.js"),homepage=read("website/index.html");
test("Phase 17 business account readiness (offline)",async t=>{
 await t.test("Owner identity is required for private profile access",()=>{
  assert.match(rules,/function isOwner\(userId\)\s*\{[\s\S]*?request\.auth != null[\s\S]*?request\.auth\.uid == userId/);
  assert.match(rules,/function isVerifiedOwner\(userId\)\s*\{[\s\S]*?isOwner\(userId\)[\s\S]*?request\.auth\.token\.email_verified == true/);
  assert.match(rules,/match \/users\/\{userId\}\/business\/\{documentId\}/);
  assert.match(rules,/allow read: if isVerifiedOwner\(userId\)\s*&& documentId == "profile"/);
  assert.match(rules,/allow create, update: if isVerifiedOwner\(userId\)\s*&& documentId == "profile"/);
  assert.match(rules,/request\.resource\.data\.businessId == userId/);
  assert.match(rules,/request\.resource\.data\.acceptingBookings == false/);
  assert.match(rules,/allow delete: if false;/);
 });
 await t.test("Publishing and unpublishing require verified Firebase identity",()=>{
  assert.match(backend,/function verifiedUser\(request\)\s*\{[\s\S]*?auth\.token\.email_verified !== true/);
  for(const name of ["publishBusiness","unpublishBusiness","publishPublicCatalogue"]){
   const start=backend.indexOf("exports."+name+" = onCall(");
   assert.ok(start>=0,name+" missing");
   const next=backend.indexOf("\nexports.",start+10);
   const block=backend.slice(start,next<0?undefined:next);
   assert.match(block,/verifiedUser\(request\)/,name+" must verify identity");
  }
  assert.match(backend,/profile\.businessId !== uid/);
  assert.match(backend,/slugSnapshot\.get\("businessId"\) !== uid/);
  assert.doesNotMatch(backend,/acceptingBookings:\s*true\b/);
 });
 await t.test("Website does not misrepresent business registration as live",()=>{
  assert.match(homepage,/Run your business with Boustio/);
  assert.match(homepage,/Public online bookings are coming soon/);
  assert.doesNotMatch(homepage,/<form\b[^>]*(?:register|signup|sign-up)/i);
  assert.doesNotMatch(homepage,/createUserWithEmailAndPassword\s*\(/);
  assert.doesNotMatch(homepage,/signInWithEmailAndPassword\s*\(/);
 });
});
