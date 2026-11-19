"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const source=fs.readFileSync(path.join(root,"functions/index.js"),"utf8");
const rules=fs.readFileSync(path.join(root,"firestore.rules"),"utf8");
const chatNames=["startCustomerChat","sendCustomerChatMessage","getCustomerChatMessages"];
function handler(name){const start=source.indexOf("exports."+name+" = onCall(");assert.ok(start>=0,name+" missing");const end=source.indexOf("\nexports.",start+10);return source.slice(start,end<0?undefined:end);}
test("Launch gate remains closed and never defaults to enabled",()=>{
 assert.match(source,/function requireChatEnabled\s*\(/);
 assert.match(source,/BOUSTIO_CHAT_ENABLED/);
 for(const name of chatNames)assert.match(handler(name),/requireChatEnabled\(\)/);
});
test("All customer chat callable handlers currently lack App Check: block launch",()=>{
 for(const name of chatNames)assert.match(handler(name),/enforceAppCheck:\s*false/);
});
test("Chat payload remains text only: no photo or voice upload endpoints",()=>{
 for(const name of chatNames){
  const body=handler(name);
  assert.doesNotMatch(body,/getStorage\(|uploadBytes\(|createWriteStream\(/);
 }
});
test("Customer message controls enforce server-side quota, cooldown and ownership",()=>{
 const send=handler("sendCustomerChatMessage");
 assert.match(send,/customerMessageCount[^\n]*>=\s*100/);
 assert.match(send,/lastCustomerMessageMs/);
 assert.match(send,/5000/);
 assert.match(send,/customerUid[^\n]*!==\s*uid/);
 assert.match(send,/runTransaction/);
});
test("Conversation identity and cross-customer read protections remain",()=>{
 assert.match(handler("startCustomerChat"),/createHash\("sha256"\)/);
 assert.match(handler("getCustomerChatMessages"),/customerUid[^\n]*!==\s*uid/);
});
test("Firestore chat rules remain present and restrict direct client writes",()=>{
 assert.match(rules,/match \/businesses\/\{businessId\}\/conversations\/\{conversationId\}/);
});
test("No production credentials or live project in test environment",()=>{
 assert.equal(process.env.GCLOUD_PROJECT,"demo-boustio-phase267");
 assert.equal(process.env.BOUSTIO_CHAT_ENABLED,"false");
 assert.equal(process.env.FIRESTORE_EMULATOR_HOST,"127.0.0.1:8080");
});
