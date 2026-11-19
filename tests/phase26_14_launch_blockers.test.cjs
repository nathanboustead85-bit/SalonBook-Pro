"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {assessChatLaunchReadiness,REQUIRED}=require("../functions/chatLaunchReadiness");
const source=fs.readFileSync(path.resolve(__dirname,"../functions/index.js"),"utf8");
const rules=fs.readFileSync(path.resolve(__dirname,"../firestore.rules"),"utf8");
test("Production default is not launch ready",()=>{
 const result=assessChatLaunchReadiness({});
 assert.equal(result.ready,false);
 assert.equal(result.blockers.length,REQUIRED.length);
});
test("App Check alone cannot authorize launch",()=>{
 const result=assessChatLaunchReadiness({BOUSTIO_CHAT_APP_CHECK_ENFORCED:"true"});
 assert.equal(result.ready,false);
 assert.ok(result.blockers.includes("BOUSTIO_CHAT_TRUSTED_ABUSE_SIGNAL"));
});
test("Budget limits alone cannot prevent account rotation",()=>{
 const result=assessChatLaunchReadiness({BOUSTIO_CHAT_ABUSE_BUDGET_ENABLED:"true",BOUSTIO_CHAT_ENABLED:"true"});
 assert.equal(result.ready,false);
 assert.ok(result.blockers.includes("BOUSTIO_CHAT_APP_CHECK_ENFORCED"));
 assert.ok(result.blockers.includes("BOUSTIO_CHAT_TRUSTED_ABUSE_SIGNAL"));
});
test("Trusted signal requires App Check in readiness assessment",()=>{
 const result=assessChatLaunchReadiness({BOUSTIO_CHAT_TRUSTED_ABUSE_SIGNAL:"true"});
 assert.ok(result.blockers.includes("TRUSTED_SIGNAL_REQUIRES_APP_CHECK"));
});
test("Only explicitly satisfied controls yield a readiness assessment",()=>{
 const result=assessChatLaunchReadiness(Object.fromEntries(REQUIRED.map(k=>[k,"true"])));
 assert.equal(result.ready,true);
 // This is only an assessment of declared settings, not proof of implementation.
});
test("Callable chat handlers still require disabled-by-default gate",()=>{
 for(const name of ["startCustomerChat","sendCustomerChatMessage","getCustomerChatMessages"]){
  const start=source.indexOf("exports."+name+" = onCall(");
  const end=source.indexOf("\nexports.",start+10);
  const body=source.slice(start,end<0?undefined:end);
  assert.ok(start>=0);
  assert.match(body,/requireChatEnabled\(\)/);
  assert.match(body,/enforceAppCheck: false/);
 }
});
test("No client-supplied risk signal is accepted by atomic budget",()=>{
 const atomic=fs.readFileSync(path.resolve(__dirname,"../functions/chatAbuseBudgetAtomic.js"),"utf8");
 assert.doesNotMatch(atomic,/input\.signal|request\.data\.signal/);
});
test("Firestore rules explicitly guard customer conversation paths",()=>{
 assert.match(rules,/match \/businesses\/\{businessId\}\/conversations\/\{conversationId\}/);
});
test("Launch readiness checks do not mutate environment",()=>{
 const env={BOUSTIO_CHAT_ENABLED:"false"};
 assessChatLaunchReadiness(env);
 assert.equal(env.BOUSTIO_CHAT_ENABLED,"false");
});
