"use strict";
// Phase 27.12: read-only source-based integration audit, never a launch approval.
const fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,p),"utf8");
function auditMessagingIntegration(){
 const index=read("index.js"),budget=read("chatAbuseBudgetAtomic.js"),v2=read("chatRetentionV2Atomic.js"),recovery=read("chatRetentionRecovery.js"),preflight=read("chatReleasePreflight.js"),schema=read("chatRetentionSchemaAudit.js");
 const controls=[
  {id:"chat-default-off",ready:index.includes('process.env.BOUSTIO_CHAT_ENABLED !== "true"'),level:"wired"},
  {id:"legacy-budget-gated",ready:index.includes('process.env.BOUSTIO_CHAT_ABUSE_BUDGET_ENABLED==="true"')&&index.includes("consumeBudgetWithinTransaction"),level:"wired-optional"},
  {id:"legacy-atomic-transaction",ready:budget.includes("tx.set(ref")&&budget.includes("tx.get(ref"),level:"wired-optional"},
  {id:"v2-counter-integrated",ready:index.includes('require("./chatRetentionV2Atomic")'),level:"not-wired"},
  {id:"recovery-integrated",ready:index.includes('require("./chatRetentionRecovery")'),level:"not-wired"},
  {id:"app-check-enforced",ready:/startCustomerChat\s*=\s*onCall\(\s*\{[^}]*enforceAppCheck:\s*true/s.test(index)&&/sendCustomerChatMessage\s*=\s*onCall\(\s*\{[^}]*enforceAppCheck:\s*true/s.test(index),level:"launch-blocker"},
  {id:"trusted-correlation-integrated",ready:index.includes('require("./chatTrustedCorrelation")'),level:"launch-blocker"},
  {id:"real-monitoring-integrated",ready:index.includes('require("./chatAbuseMonitoring")'),level:"launch-blocker"},
  {id:"ttl-schema-compatible",ready:!schema.includes("NESTED_SUBCOLLECTION_TTL_POLICY_REQUIRED")&&v2.includes("expiresAt"),level:"launch-blocker"},
  {id:"production-launch-approval",ready:!preflight.includes('decision:"BLOCKED"'),level:"manual-blocker"}
 ];
 const blockers=controls.filter(c=>!c.ready).map(c=>c.id);
 return Object.freeze({decision:"BLOCKED",mayEnableMessaging:false,reviewType:"SOURCE_ONLY",controls:Object.freeze(controls.map(c=>Object.freeze(c))),blockers:Object.freeze(blockers),summary:Object.freeze({wired:controls.filter(c=>c.ready).length,notReady:blockers.length}),notes:Object.freeze(["No deployed runtime, real token verification, Firebase TTL policy or production monitoring verified.","No production data read or modified."])});
}
module.exports={auditMessagingIntegration};
