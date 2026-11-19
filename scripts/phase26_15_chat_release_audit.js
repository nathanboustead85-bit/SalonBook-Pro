"use strict";
// Phase 26.15: read-only, fail-closed release assessment. Never activates features.
const fs=require("node:fs"),path=require("node:path");
const {assessChatLaunchReadiness}=require("../functions/chatLaunchReadiness");
function audit({root=path.resolve(__dirname,".."),env={}}={}){
 const index=fs.readFileSync(path.join(root,"functions/index.js"),"utf8");
 const rules=fs.readFileSync(path.join(root,"firestore.rules"),"utf8");
 const atomic=fs.readFileSync(path.join(root,"functions/chatAbuseBudgetAtomic.js"),"utf8");
 const blockers=[];
 const checks={
  customerStartGated:/exports\.startCustomerChat = onCall\([\s\S]*?requireChatEnabled\(\)/.test(index),
  customerSendGated:/exports\.sendCustomerChatMessage = onCall\([\s\S]*?requireChatEnabled\(\)/.test(index),
  customerReadGated:/exports\.getCustomerChatMessages = onCall\([\s\S]*?requireChatEnabled\(\)/.test(index),
  chatDefaultDisabled:env.BOUSTIO_CHAT_ENABLED!=="true",
  abuseBudgetDefaultDisabled:env.BOUSTIO_CHAT_ABUSE_BUDGET_ENABLED!=="true",
  atomicBudgetAvailable:atomic.includes("consumeBudgetWithinTransaction")&&index.includes("consumeBudgetWithinTransaction(tx,db,{businessId,uid,now})"),
  customerDirectWritesDenied:/match \/businesses\/\{businessId\}\/conversations\/\{conversationId\} \{[\s\S]*?allow create, update, delete: if false;/.test(rules),
  messageDirectWritesDenied:/match \/messages\/\{messageId\} \{[\s\S]*?allow create, update, delete: if false;/.test(rules),
  appCheckEnforced:/exports\.startCustomerChat = onCall\(\s*\{[^}]*enforceAppCheck: true/.test(index)&&/exports\.sendCustomerChatMessage = onCall\(\s*\{[^}]*enforceAppCheck: true/.test(index),
  trustedRotationProtection:false,
  operationalMonitoringVerified:false,
  attachmentSecurityVerified:false
 };
 for(const [key,value] of Object.entries(checks))if(!value)blockers.push(key);
 const declared=assessChatLaunchReadiness(env);
 // Never infer real-world security enforcement from environment declarations.
 return {phase:"26.15",decision:"NOT_READY_FOR_PUBLIC_LAUNCH",checks,blockers:[...new Set([...blockers,...declared.blockers])],nextAction:"Keep customer messaging disabled. Implement and independently verify launch blockers before release."};
}
module.exports={audit};
