"use strict";
// Phase 33.8: offline authorization policy only. Never authorizes Firebase operations.
const {expireSession}=require("./dashboard-session-33-7");
const READ=Object.freeze(["view_business","view_services","view_staff","view_opening_hours","view_summary"]);
const ACTIONS=new Set(READ);
const empty=Object.freeze([]);
const deny=reason=>Object.freeze({status:"DENIED",reason,allowed:false,bookingEnabled:false,editingEnabled:false,data:null});
const id=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{1,80}$/.test(x);
function authorizeDashboardRead(session,principal,action,now){
 if(!Number.isSafeInteger(now)||now<0)return deny("invalid_clock");
 if(!principal||!id(principal.uid)||principal.emailVerified!==true)return deny("unverified_principal");
 if(!session||session.status!=="DASHBOARD_READY"||!id(session.ownerId)||session.ownerId!==principal.uid)return deny("owner_or_state_mismatch");
 if(!Number.isSafeInteger(session.expiresAt)||now>=session.expiresAt)return deny("expired_session");
 if(!session.dashboard||session.dashboard.status!=="ASSEMBLED_READ_ONLY"||session.dashboard.ownerId!==principal.uid||session.dashboard.bookingEnabled!==false||session.dashboard.editingEnabled!==false)return deny("untrusted_dashboard");
 if(!Number.isSafeInteger(session.dashboard.expiresAt)||now>=session.dashboard.expiresAt)return deny("expired_snapshot");
 if(!ACTIONS.has(action))return deny("action_not_permitted");
 const d=session.dashboard;
 const value=action==="view_business"?d.business:action==="view_services"?d.services:action==="view_staff"?d.staff:action==="view_opening_hours"?d.openingHours:d.summary;
 if(value===undefined||value===null)return deny("missing_section");
 return Object.freeze({status:"READ_ONLY_ALLOWED",reason:null,allowed:true,bookingEnabled:false,editingEnabled:false,data:value});
}
function enforceSessionExpiry(session,now){
 const current=expireSession(session,now);
 if(current.status==="SIGNED_OUT")return Object.freeze({status:"DENIED",reason:"expired_session",allowed:false,bookingEnabled:false,editingEnabled:false,data:null});
 return Object.freeze({status:"SESSION_CHECKED",reason:null,allowed:false,bookingEnabled:false,editingEnabled:false,data:null});
}
module.exports=Object.freeze({authorizeDashboardRead,enforceSessionExpiry,READ});
