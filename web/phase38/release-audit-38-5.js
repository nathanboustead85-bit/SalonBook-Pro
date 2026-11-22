"use strict";
// Deterministic audit of isolated Phase 38 controls. Never grants launch approval.
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const required=[
 ["schema","web/phase38/schema-compatibility-38-2.js",["validateDocumentFreshness","mapStaff","bookingEnabled:false","editingEnabled:false"]],
 ["authorization","web/phase38/owner-authorization-38-3.js",["token.claims.user_id!==uid","token.claims.email_verified!==true","result?.atomic!==true","sequence!==epoch"]],
 ["recovery","web/phase38/dashboard-recovery-38-4.js",["request!==epoch","maxRetries","networkUnavailable","accountChanged","signOut"]],
 ["firestore","firestore.rules",["function isVerifiedOwner(userId)","allow delete: if false;","customerBookingReservations","allow read, write: if false;"]],
 ["emulator","firebase.phase32-4.json",["127.0.0.1","18080","19099"]]
];
function auditRepository(){
 const findings=[];
 for(const [id,file,markers] of required){
  let content;try{content=read(file)}catch{findings.push({id,severity:"P0",reason:"required_file_missing"});continue}
  for(const marker of markers)if(!content.includes(marker))findings.push({id,severity:"P0",reason:"required_guard_missing",marker});
 }
 for(const file of ["web/phase38/schema-compatibility-38-2.js","web/phase38/owner-authorization-38-3.js","web/phase38/dashboard-recovery-38-4.js"]){
  const content=read(file);
  if(/firebase\/app|initializeApp\s*\(|firebase-admin|https?:\/\//.test(content))findings.push({id:file,severity:"P0",reason:"unexpected_production_or_network_dependency"});
 }
 return Object.freeze({status:findings.length?"AUDIT_FAILED":"ISOLATED_GATES_VERIFIED",productionLaunchApproved:false,liveBookingsEnabled:false,paymentsEnabled:false,messagingEnabled:false,deploymentApproved:false,findings:Object.freeze(findings)});
}
module.exports=Object.freeze({auditRepository});
