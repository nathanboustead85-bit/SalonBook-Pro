"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");

test("Phase 17 customer booking preview stays non-transactional",async t=>{
 const html=read("website/book/index.html");
 const rules=read("firestore.rules");
 await t.test("Confirmation remains visibly disabled and preview-only",()=>{
  assert.match(html,/<button\b[^>]*class="disabled-action"[^>]*type="button"[^>]*disabled[^>]*>Booking unavailable[^<]*preview only<\/button>/i);
  assert.match(html,/nothing is submitted and no customer information is collected/i);
  assert.match(html,/Never submit or persist a selection as a booking/);
 });
 await t.test("Customer page has no booking submission or local persistence",()=>{
  assert.doesNotMatch(html,/fetch\s*\([^)]*,\s*\{[^}]*method\s*:\s*['"`]?(POST|PUT|PATCH|DELETE)\b/is);
  assert.doesNotMatch(html,/\b(?:localStorage|sessionStorage|indexedDB)\s*\./);
  assert.doesNotMatch(html,/\b(?:addDoc|setDoc|updateDoc|deleteDoc|runTransaction|writeBatch)\s*\(/);
  assert.doesNotMatch(html,/<form\b[^>]*action\s*=/i);
 });
 await t.test("Public business documents cannot be written by web clients",()=>{
  const block=rules.match(/match \/publicBusinesses\/\{businessId\}\s*\{([\s\S]*?)\n\s*\}/);
  assert.ok(block,"publicBusinesses rules must exist");
  assert.match(block[1],/allow create, update, delete:\s*if false;/);
 });
});
