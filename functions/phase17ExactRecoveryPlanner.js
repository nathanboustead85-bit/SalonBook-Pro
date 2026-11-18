"use strict";
/**
 * Offline exact-revision recovery decision boundary.
 * Does NOT invoke remote writers, mutate journals or coordinate databases.
 * Only a destination-transaction-local authoritative claim is acceptable.
 */
const {verifyExactIdentity}=require("./phase17ExactPublicationIdentity");
const {compareRevisions}=require("./phase17FullPrecisionRevision");
const TERMINAL=new Set(["CONFIRMED","BLOCKED"]);
const RETRY=new Set(["PENDING","UNKNOWN"]);
function planExactRecovery({identity,journal,sourceSnapshot,claimPlacement,workerClaim}={}){
 if(!identity||typeof identity.key!=="string"||typeof identity.digest!=="string"||
    identity.key!==identity.uid+":"+identity.operation+":"+identity.revision||
    !["publish","unpublish"].includes(identity.operation))
  throw Error("INVALID_EXACT_RECOVERY_IDENTITY");
 compareRevisions(identity.revision,identity.revision);
 if(!journal||journal.key!==identity.key||journal.digest!==identity.digest||
    journal.revision!==identity.revision||journal.uid!==identity.uid||
    journal.operation!==identity.operation||
    !Number.isSafeInteger(journal.casRevision)||journal.casRevision<1)
  throw Error("EXACT_RECOVERY_JOURNAL_MISMATCH");
 if(TERMINAL.has(journal.state))return Object.freeze({status:"TERMINAL",state:journal.state});
 if(!RETRY.has(journal.state))throw Error("INVALID_EXACT_RECOVERY_STATE");
 if(!sourceSnapshot||!verifyExactIdentity(identity,sourceSnapshot))
  return Object.freeze({status:"SOURCE_CHANGED",action:"BLOCK_OR_RECONCILE"});
 if(claimPlacement!=="destination-transaction")
  return Object.freeze({status:"UNSAFE_CLAIM_PLACEMENT",action:"DO_NOT_WRITE"});
 if(!workerClaim||workerClaim.key!==identity.key||workerClaim.digest!==identity.digest||
    workerClaim.state!=="HELD"||typeof workerClaim.worker!=="string"||
    !Number.isSafeInteger(workerClaim.generation)||workerClaim.generation<1)
  return Object.freeze({status:"NO_VALID_CLAIM",action:"DO_NOT_WRITE"});
 return Object.freeze({status:"READY_FOR_DESTINATION_RECHECK",operation:identity.operation,
  expectedJournalRevision:journal.casRevision,
  warning:"DESTINATION_MUST_RECHECK_AUTHORITATIVE_CLAIM_ATOMICALLY"});
}
module.exports=Object.freeze({planExactRecovery});
