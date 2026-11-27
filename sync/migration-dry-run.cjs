"use strict";
const {detectConflicts}=require("./migration-conflicts.cjs");
// Read-only normalized data rehearsal. Never authorizes cutover.
function dryRun(identity,raw,digest,businessId){
 if(!identity||identity.verified!==true||identity.uid!==businessId)throw Error("Denied");
 const report=detectConflicts(raw,digest,businessId);
 return Object.freeze({...report,mode:"dry-run-only",migrationAllowed:false,writes:0});
}
module.exports={dryRun};