"use strict";
/**
 * Phase 17 offline-only full-precision publication identity.
 * Explicitly separate from legacy numeric journal/fence/writer contracts.
 * Production must atomically migrate all consumers before using these IDs.
 */
const {createHash}=require("node:crypto");
const {compareRevisions}=require("./phase17FullPrecisionRevision");
const {revisionContractFromSnapshot}=require("./phase17PrecisionMigrationGate");
const {preparePublicListing}=require("./phase17PublicListingProjection");
function canonical(value){
 if(value===null||typeof value==="string"||typeof value==="boolean")return value;
 if(typeof value==="number"&&Number.isFinite(value))return value;
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==="object"&&Object.getPrototypeOf(value)===Object.prototype)
  return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
 throw Error("NONCANONICAL_PUBLICATION_VALUE");
}
function exactPublicationIdentity({uid,operation,snapshot,profile}){
 if(typeof uid!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(uid)||
  !["publish","unpublish"].includes(operation))throw Error("INVALID_EXACT_PUBLICATION_IDENTITY");
 const revision=revisionContractFromSnapshot(snapshot);
 compareRevisions(revision.fullPrecisionRevision,revision.fullPrecisionRevision);
 if(operation==="unpublish"&&profile!==undefined)throw Error("UNPUBLISH_PROFILE_FORBIDDEN");
 const listing=operation==="publish"?preparePublicListing(uid,profile):null;
 if(operation==="publish"&&profile&&Object.keys(profile).some(k=>!Object.hasOwn(listing,k)))
  throw Error("PRIVATE_PROFILE_FIELD_REJECTED");
 const token=revision.fullPrecisionRevision;
 const key=uid+":"+operation+":"+token;
 const digest=createHash("sha256").update(JSON.stringify(canonical({
  uid,operation,revision:token,profile:listing
 }))).digest("hex");
 return Object.freeze({key,digest,uid,operation,revision:token,
  legacyVersion:revision.legacyVersion,legacyRepresentable:revision.legacyRepresentable});
}
function verifyExactIdentity(identity,sourceSnapshot){
 if(!identity||typeof identity!=="object"||typeof identity.revision!=="string")
  throw Error("INVALID_EXACT_PUBLICATION_IDENTITY");
 return compareRevisions(identity.revision,revisionContractFromSnapshot(sourceSnapshot).fullPrecisionRevision)===0;
}
module.exports=Object.freeze({exactPublicationIdentity,verifyExactIdentity});
