"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const source=fs.readFileSync(path.resolve(__dirname,"../functions/index.js"),"utf8");
const atomic=fs.readFileSync(path.resolve(__dirname,"../functions/chatAbuseBudgetAtomic.js"),"utf8");
test("Messaging and abuse budget remain off by default",()=>{
 assert.notEqual(process.env.BOUSTIO_CHAT_ENABLED,"true");
 assert.notEqual(process.env.BOUSTIO_CHAT_ABUSE_BUDGET_ENABLED,"true");
 assert.match(source,/chatAbuseBudgetEnabled=\(\)=>process\.env\.BOUSTIO_CHAT_ABUSE_BUDGET_ENABLED==="true"/);
});
test("Start and send share transaction-atomic abuse budget",()=>{
 for(const name of ["startCustomerChat","sendCustomerChatMessage"]){
  const start=source.indexOf("exports."+name+" = onCall("),end=source.indexOf("\nexports.",start+10);
  const body=source.slice(start,end<0?undefined:end);
  assert.match(body,/consumeBudgetWithinTransaction\(tx,db,\{businessId,uid,now\}\)/);
  assert.match(body,/if \(!budget\.allowed\) throw new HttpsError\("resource-exhausted"/);
  assert.match(body,/tx\.create\(/);
 }
});
test("Budget module reads all counters before writing",()=>{
 assert.match(atomic,/Promise\.all\(refs\.map\(ref=>tx\.get\(ref\)\)\)/);
 assert.match(atomic,/tx\.set\(/);
 assert.doesNotMatch(atomic,/runTransaction\(/);
});
test("No App Check activation or production deployment",()=>{
 assert.match(source,/exports\.startCustomerChat = onCall\(\s*\{[^}]*enforceAppCheck: false/);
 assert.match(source,/requireChatEnabled\(\)/);
});
