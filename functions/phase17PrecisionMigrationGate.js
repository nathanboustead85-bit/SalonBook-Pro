"use strict";
/**
 * Offline-only revision migration contract. No production rollout.
 * A token must come from a trusted private Firestore snapshot, never a
 * client-controlled payload. Legacy numeric versions cannot distinguish
 * two submicrosecond revisions; refuse such updates until all components
 * use the exact token (journal, fence, digest, boundary and writer).
 */
const {fullPrecisionRevision,compareRevisions}=require("./phase17FullPrecisionRevision");
const MAX_SECONDS=Math.floor(Number.MAX_SAFE_INTEGER/1000000);
function revisionContractFromSnapshot(snapshot){
 const token=fullPrecisionRevision(snapshot);
 const {seconds,nanoseconds}=snapshot.updateTime;
 if(seconds>MAX_SECONDS)throw Error("REVISION_NUMERIC_OVERFLOW");
 const numeric=seconds*1000000+Math.floor(nanoseconds/1000);
 if(!Number.isSafeInteger(numeric)||numeric<1)throw Error("REVISION_NUMERIC_OVERFLOW");
 return Object.freeze({fullPrecisionRevision:token,legacyVersion:numeric,legacyRepresentable:nanoseconds%1000===0});
}
function assertLegacyCompatibleRevision(revision){
 if(!revision||typeof revision!=="object"||!revision.legacyRepresentable)
  throw Error("FULL_PRECISION_MIGRATION_REQUIRED");
 if(!Number.isSafeInteger(revision.legacyVersion)||revision.legacyVersion<1)
  throw Error("INVALID_LEGACY_REVISION");
 compareRevisions(revision.fullPrecisionRevision,revision.fullPrecisionRevision);
 const [seconds,nanos]=revision.fullPrecisionRevision.split(":").map(Number);
 if(nanos%1000!==0||seconds*1000000+nanos/1000!==revision.legacyVersion)
  throw Error("REVISION_CONTRACT_MISMATCH");
 return revision.legacyVersion;
}
function compareExactSourceRevisions(a,b){
 if(!a||!b)throw Error("MISSING_REVISION_CONTRACT");
 return compareRevisions(a.fullPrecisionRevision,b.fullPrecisionRevision);
}
module.exports=Object.freeze({revisionContractFromSnapshot,assertLegacyCompatibleRevision,compareExactSourceRevisions});
