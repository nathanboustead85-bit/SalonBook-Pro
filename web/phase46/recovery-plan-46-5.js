"use strict";
// Pure synthetic recovery planner. Never accepts or accesses real appointment data.
const {createHash}=require("node:crypto");
const {assessLaunchGaps}=require("./readiness-gaps-46-1");
const deny=reason=>Object.freeze({status:"BLOCKED",reason,restoreExecuted:false,migrationApproved:false,canDeploy:false,canBook:false,canPay:false,canMessage:false});
const digest=x=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
const validOwner=x=>typeof x==="string"&&/^synthetic-[a-z0-9-]{3,60}$/.test(x);
function createRecoveryPlan({ownerId,records,revision=1}={}){
 if(!validOwner(ownerId)||!Array.isArray(records)||records.length<1||records.length>100||!Number.isSafeInteger(revision)||revision<1)return deny("synthetic_inventory_required");
 if(records.some(x=>!x||typeof x!=="object"||Array.isArray(x)||!/^fixture-[a-z0-9-]{1,60}$/.test(x.id||"")||!Number.isSafeInteger(x.version)||x.version<1||x.ownerId!==ownerId||x.acceptingBookings!==false))return deny("invalid_or_cross_owner_fixture");
 const ids=records.map(x=>x.id);if(new Set(ids).size!==ids.length)return deny("duplicate_fixture");
 const snapshot=records.map(x=>Object.freeze({id:x.id,ownerId:x.ownerId,version:x.version,acceptingBookings:false})).sort((a,b)=>a.id.localeCompare(b.id));
 const checksum=digest({ownerId,revision,snapshot});
 return Object.freeze({status:"SYNTHETIC_INVENTORY_READY",ownerId,revision,count:snapshot.length,checksum,inventory:Object.freeze(snapshot),restoreExecuted:false,migrationApproved:false,canDeploy:false,canBook:false,canPay:false,canMessage:false});
}
function verifyRestore({plan,restored,ownerApproval=false}={}){
 if(!plan||plan.status!=="SYNTHETIC_INVENTORY_READY"||!Array.isArray(restored))return deny("inventory_missing");
 if(ownerApproval!==true)return deny("owner_approval_required");
 const candidate=createRecoveryPlan({ownerId:plan.ownerId,revision:plan.revision,records:restored});
 if(candidate.status!=="SYNTHETIC_INVENTORY_READY"||candidate.checksum!==plan.checksum)return deny("restore_integrity_mismatch");
 if(assessLaunchGaps().openCount!==7)return deny("launch_gate_changed");
 return Object.freeze({status:"SYNTHETIC_RESTORE_VERIFIED",checksum:plan.checksum,restoreExecuted:false,migrationApproved:false,canDeploy:false,canBook:false,canPay:false,canMessage:false});
}
function rollbackChecklist(plan){
 if(!plan||plan.status!=="SYNTHETIC_INVENTORY_READY")return deny("inventory_missing");
 return Object.freeze({status:"ROLLBACK_PLAN_ONLY",steps:Object.freeze(["Verify independent non-destructive backup evidence","Obtain explicit owner approval for any real-data operation","Validate isolated restore checksums and ownership","Document recovery point and reversible rollback","Require separate staging security and release authorization"]),originalAndroidAppointments:"UNTOUCHED_NOT_INSPECTED",rollbackExecuted:false,migrationApproved:false,canDeploy:false,canBook:false,canPay:false,canMessage:false});
}
module.exports=Object.freeze({createRecoveryPlan,verifyRestore,rollbackChecklist});
