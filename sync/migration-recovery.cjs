"use strict";
const {dryRun}=require("./migration-dry-run.cjs");
// Read-only recovery rehearsal; no restoration or cutover writes.
function rehearseRecovery(identity,businessId,backup,checkpoint,currentSource){
 if(!checkpoint||checkpoint.businessId!==businessId||!Number.isSafeInteger(checkpoint.sourceRevision)||checkpoint.sourceRevision<0||!currentSource||currentSource.revision!==checkpoint.sourceRevision||currentSource.digest!==checkpoint.digest)throw Error("Source changed or invalid checkpoint");
 const report=dryRun(identity,backup,checkpoint.digest,businessId);
 if(!report.readyForReview||report.appointmentCount!==checkpoint.appointmentCount||report.customerCount!==checkpoint.customerCount)throw Error("Reconciliation failed");
 return Object.freeze({state:"rehearsal-passed",migrationAllowed:false,restoreAllowed:false,writes:0});
}
module.exports={rehearseRecovery};