"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const source=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const rules=source("firestore.rules");
const backend=source("functions/index.js");
const chat=source("website/book/customer-chat.js");

test("Phase 17 customer data protection regression (offline)",async t=>{
 await t.test("Private booking, locks and migration records deny all client access",()=>{
  for(const fragment of [
   "/users/{userId}/customerBookingReservations/{reservationId}",
   "/users/{userId}/customerBookingRequests/{requestId}",
   "/businesses/{businessId}/customerBookingGuards/{guardId}",
   "/businesses/{businessId}/bookingLocks/{lockId}",
   "/businesses/{businessId}/migrations/{migrationId}"
  ]){
   const start=rules.indexOf("match "+fragment+" {");
   assert.ok(start>=0,"Missing protected rule "+fragment);
   assert.match(rules.slice(start,start+180),/allow read, write:\s*if false;/);
  }
  assert.match(rules,/match \/\{document=\*\*\} \{\s*allow read, write: if false;/);
 });
 await t.test("Appointments and private conversations cannot be written from client SDK",()=>{
  assert.match(rules,/match \/businesses\/\{businessId\}\/appointments\/\{appointmentId\}[\s\S]*?allow create, update, delete:\s*if false;/);
  assert.match(rules,/match \/businesses\/\{businessId\}\/conversations\/\{conversationId\} \{\s*allow get, list: if isVerifiedOwner\(businessId\);\s*allow create, update, delete: if false;/);
  assert.match(rules,/match \/messages\/\{messageId\} \{\s*allow get, list: if isVerifiedOwner\(businessId\);\s*allow create, update, delete: if false;/);
 });
 await t.test("Customer chat is disabled on website and server unless explicitly activated",()=>{
  assert.match(chat,/const CHAT_ENABLED = false\s*;/);
  assert.match(chat,/if \(!CHAT_ENABLED\) \{\s*setStatus\("Customer messaging is not live yet\."\);\s*return;/);
  assert.match(backend,/function requireChatEnabled\(\) \{\s*if \(process\.env\.BOUSTIO_CHAT_ENABLED !== "true"\)/);
  for(const name of ["startCustomerChat","sendCustomerChatMessage","getCustomerChatMessages"]){
   const start=backend.indexOf("exports."+name+" = onCall(");
   assert.ok(start>=0,name+" missing");
   const next=backend.indexOf("\nexports.",start+8);
   const body=backend.slice(start,next<0?undefined:next);
   assert.match(body,/customerChatIdentity\(request\)/,name+" must authenticate guest");
   assert.match(body,/requireChatEnabled\(\)/,name+" must respect server switch");
  }
 });
 await t.test("Guest message reads and writes enforce conversation ownership",()=>{
  assert.match(backend,/auth\.token\.firebase\.sign_in_provider !== "anonymous"/);
  assert.ok((backend.match(/snap\.get\("customerUid"\) !== uid/g)||[]).length>=2);
  assert.ok((backend.match(/snap\.get\("businessId"\) !== businessId/g)||[]).length>=2);
  assert.match(backend,/customerMessageCount"\) \|\| 1\) >= 100/);
  assert.match(backend,/lastCustomerMessageMs"\) \|\| 0\) < 5000/);
  assert.match(backend,/\.orderBy\("createdAt", "desc"\)\.limit\(50\)/);
 });
});
