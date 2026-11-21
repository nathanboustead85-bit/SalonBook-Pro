"use strict";
// Phase 36.5 isolated audit. No Firebase initialization, writes or deployment.
const {createSecureDashboardSession,project}=require("./secure-dashboard-session-36-4");
const REQUIRED=Object.freeze(["canBook","canEdit","canMessage","canPay"]);
const deny=reason=>Object.freeze({passed:false,reason});
function auditView(state){
 if(!state||typeof state!=="object")return deny("invalid_view");
 if(!["READY","LOADING","SIGNED_OUT","UNAVAILABLE","RECOVERY"].includes(state.view))return deny("unknown_view");
 if(REQUIRED.some(k=>state[k]!==false))return deny("live_feature_enabled");
 if(state.view!=="READY"&&(state.business!==null||!Array.isArray(state.services)||state.services.length!==0||!Array.isArray(state.staff)||state.staff.length!==0))return deny("private_data_leak");
 if(state.view==="READY"&&(!state.business||!Array.isArray(state.services)||!Array.isArray(state.staff)))return deny("invalid_ready_view");
 return Object.freeze({passed:true,reason:null});
}
function createAuditedDashboard(deps){
 const session=createSecureDashboardSession(deps);
 const inspect=()=>{const state=session.snapshot(),result=auditView(state);return result.passed?state:project({status:"UNAVAILABLE",reason:"audit_rejected"})};
 return Object.freeze({
  start:()=>{session.start();return inspect()},
  stop:()=>{session.stop();return inspect()},
  networkUnavailable:()=>{session.networkUnavailable();return inspect()},
  networkRestored:async()=>{await session.networkRestored();return inspect()},
  retry:async()=>{await session.retry();return inspect()},
  snapshot:inspect
 });
}
module.exports=Object.freeze({auditView,createAuditedDashboard});
