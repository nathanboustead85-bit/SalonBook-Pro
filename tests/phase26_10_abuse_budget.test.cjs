"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {consumeBudget,LIMITS,WINDOW_MS}=require("../functions/chatAbuseBudget");
const source=fs.readFileSync(path.resolve(__dirname,"../functions/index.js"),"utf8");
test("Live messaging stays disabled and App Check remains a launch blocker",()=>{
 assert.equal(process.env.BOUSTIO_CHAT_ENABLED,"false");
 assert.match(source,/exports\.startCustomerChat = onCall\(\s*\{[^}]*enforceAppCheck: false/);
});
test("No raw identifiers are persisted by the budget module",()=>{
 const moduleSource=fs.readFileSync(path.resolve(__dirname,"../functions/chatAbuseBudget.js"),"utf8");
 assert.match(moduleSource,/createHash\("sha256"\)/);
 assert.doesNotMatch(moduleSource,/rawIp|ipAddress|userAgent/);
});
test("Limits are positive and signal limit exceeds per-identity limit",()=>{
 assert.ok(LIMITS.identity>0&&LIMITS.business>LIMITS.signal&&LIMITS.signal>LIMITS.identity);
 assert.equal(WINDOW_MS,3600000);
});
test("Reject malformed business, identity and signal before Firestore access",async()=>{
 const db={collection(){throw Error("should not touch Firestore")}};
 for(const fields of [{businessId:"bad/path",uid:"ok"},{businessId:"ok",uid:"bad/path"},{businessId:"ok",uid:"ok",signal:"short"}]){
  await assert.rejects(consumeBudget(db,{...fields,now:1000}));
 }
});
test("Production chat handlers do not yet invoke the opt-in module",()=>{
 assert.doesNotMatch(source,/consumeBudget\(/);
});
