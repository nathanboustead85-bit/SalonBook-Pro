"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
test("Phase 18 onboarding foundations stay offline and locked",async t=>{
 const html=read("website/business/register/index.html");
 const js=read("website/business/register/preview.js");
 const rules=read("firestore.rules");
 await t.test("Registration is explicitly preview-only",()=>{
  assert.match(html,/Development preview only/);
  assert.match(html,/Registration coming soon[^<]*preview only<\/button>/);
  assert.match(html,/<button[^>]*type="button" disabled/);
  assert.match(html,/Nothing entered here is sent or saved/);
  assert.match(js,/REGISTRATION_ENABLED = false/);
  assert.doesNotMatch(js,/createUserWithEmailAndPassword|fetch\s*\(|localStorage|sessionStorage|indexedDB|setDoc\s*\(/);
  assert.doesNotMatch(html,/type="password"|type="submit"|<script[^>]*firebase/i);
 });
 await t.test("Verified owner remains required for business profile writes",()=>{
  assert.match(rules,/allow create, update: if isVerifiedOwner\(userId\)/);
  assert.match(rules,/request\.resource\.data\.businessId == userId/);
  assert.match(rules,/request\.resource\.data\.acceptingBookings == false/);
 });
 await t.test("Business categories and input constraints are declared",()=>{
  for(const category of ["salon","barber","nails","beauty","wellness"])assert.ok(js.includes('"'+category+'"'));
  assert.match(js,/name\.length>=2 && name\.length<=100/);
  assert.match(js,/email\.length<=254/);
 });
});
