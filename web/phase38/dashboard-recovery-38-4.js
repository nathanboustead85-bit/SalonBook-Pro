"use strict";
// Isolated opt-in read-only recovery coordinator. No timers, SDK or production writes.
const {deny}=require("./schema-compatibility-38-2");
function createDashboardRecovery({gate,credentials,maxRetries=2}){
 if(!gate||typeof gate.load!=="function"||typeof gate.snapshot!=="function"||typeof credentials!=="function"||!Number.isInteger(maxRetries)||maxRetries<0||maxRetries>5)throw TypeError("isolated_recovery_dependencies_required");
 let epoch=0,online=true,visible=true,active=true,attempts=0,state=deny("signed_out");
 const publish=next=>{state=next;return state};
 function invalidate(reason,action){epoch++;attempts=0;publish(deny(reason));if(action)gate[action]();return state}
 async function refresh(){
  if(!active||!online||!visible)return state;
  const request=++epoch;
  publish(deny("auth_refreshing"));
  let auth;
  try{auth=await credentials()}catch{if(request===epoch)return publish(deny("credential_refresh_failed"));return state}
  if(request!==epoch||!active||!online||!visible)return state;
  // Do not reuse a token from a previous owner/session; gate validates identity and expiry.
  let next;
  try{next=await gate.load(auth)}catch{next=deny("atomic_read_failed")}
  if(request!==epoch||!active||!online||!visible)return state;
  return publish(next);
 }
 async function retry(){
  if(!active||!online||!visible)return state;
  if(attempts>=maxRetries)return publish(deny("retry_limit_reached"));
  attempts++;
  return refresh();
 }
 return Object.freeze({
  snapshot:()=>state,refresh,retry,
  networkUnavailable:()=>{online=false;return invalidate("network_unavailable","networkUnavailable")},
  async networkRestored(){online=true;attempts=0;return refresh()},
  background:()=>{visible=false;return invalidate("backgrounded","networkUnavailable")},
  async foreground(){visible=true;attempts=0;return online?refresh():state},
  signOut:()=>invalidate("signed_out","signOut"),
  accountChanged:()=>invalidate("account_changed","accountChanged"),
  stop:()=>{active=false;return invalidate("stopped","stop")}
 });
}
module.exports=Object.freeze({createDashboardRecovery});
