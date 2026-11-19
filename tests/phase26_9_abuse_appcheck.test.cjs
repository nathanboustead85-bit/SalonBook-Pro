"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const source=fs.readFileSync(path.join(root,"functions/index.js"),"utf8");
const rules=fs.readFileSync(path.join(root,"firestore.rules"),"utf8");
const names=["startCustomerChat","sendCustomerChatMessage","getCustomerChatMessages"];
function handler(name){const start=source.indexOf("exports."+name+" = onCall(");assert.ok(start>=0,name+" missing");const end=source.indexOf("\nexports.",start+10);return source.slice(start,end<0?undefined:end);}
test("Production chat remains disabled by default",()=>{assert.equal(process.env.BOUSTIO_CHAT_ENABLED,"false");for(const name of names)assert.match(handler(name),/requireChatEnabled\(\)/);});
test("App Check launch blocker is detected explicitly",()=>{for(const name of names)assert.match(handler(name),/enforceAppCheck:\s*false/);});
test("Rotating anonymous accounts bypasses per-conversation limits: release blocker",()=>{
 const start=handler("startCustomerChat"),send=handler("sendCustomerChatMessage");
 assert.match(start,/businessId \+ ":" \+ uid/);
 assert.match(send,/customerMessageCount[^\n]*>=\s*100/);
 assert.doesNotMatch(send,/globalAbuseBudget|crossAccountQuota/);
});
test("Ownership and transaction safeguards remain in place",()=>{
 const send=handler("sendCustomerChatMessage");
 assert.match(send,/customerUid[^\n]*!==\s*uid/);
 assert.match(send,/runTransaction/);
 assert.match(send,/lastCustomerMessageMs/);
 assert.match(handler("getCustomerChatMessages"),/customerUid[^\n]*!==\s*uid/);
});
test("Photo and voice uploads remain out of scope",()=>{
 for(const name of names)assert.doesNotMatch(handler(name),/getStorage\(|uploadBytes\(|createWriteStream\(/);
});
test("Conversation rules remain present",()=>assert.match(rules,/match \/businesses\/\{businessId\}\/conversations\/\{conversationId\}/));
test("CI uses only an isolated project without deployment",()=>{
 assert.equal(process.env.GCLOUD_PROJECT,"demo-boustio-phase269");
 assert.equal(process.env.BOUSTIO_CHAT_ENABLED,"false");
});
