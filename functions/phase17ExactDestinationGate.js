"use strict";
/**
 * Offline exact destination revision gate. This is a pure policy component,
 * NOT a Firestore writer, authentication boundary, or cross-database fence.
 * Never fall back to legacy numeric versions when exact mode is enabled.
 */
const {compareRevisions}=require("./phase17FullPrecisionRevision");
function exactDestinationDecision({incoming,stored}){
 if(!incoming||typeof incoming!=="object"||typeof incoming.revision!=="string"||
    typeof incoming.digest!=="string"||!/^[a-f0-9]{64}$/.test(incoming.digest))
  throw Error("INVALID_EXACT_DESTINATION_COMMAND");
 compareRevisions(incoming.revision,incoming.revision);
 if(stored===null||stored===undefined)return {status:"APPLY"};
 if(typeof stored!=="object"||typeof stored.revision!=="string"||
    typeof stored.digest!=="string"||!/^[a-f0-9]{64}$/.test(stored.digest))
  throw Error("EXACT_DESTINATION_MIGRATION_REQUIRED");
 const cmp=compareRevisions(incoming.revision,stored.revision);
 if(cmp<0)return {status:"STALE"};
 if(cmp===0)return {status:incoming.digest===stored.digest?"ALREADY_APPLIED":"REVISION_CONFLICT"};
 return {status:"APPLY"};
}
function assertExactDestinationFence({identity,claim,nowMs}){
 if(!identity||typeof identity.key!=="string"||typeof identity.digest!=="string"||
    !claim||claim.key!==identity.key||claim.digest!==identity.digest||
    claim.state!=="HELD"||typeof claim.worker!=="string"||
    !Number.isSafeInteger(claim.generation)||claim.generation<1||
    !Number.isSafeInteger(claim.expiresAt)||!Number.isSafeInteger(nowMs)||nowMs<1||
    claim.expiresAt<=nowMs)throw Error("EXACT_DESTINATION_FENCED");
 return Object.freeze({key:claim.key,worker:claim.worker,generation:claim.generation});
}
module.exports=Object.freeze({exactDestinationDecision,assertExactDestinationFence});
