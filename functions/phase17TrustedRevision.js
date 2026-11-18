"use strict";
/**
 * Phase 17 trusted revision derivation. The updateTime MUST come from the
 * server-side Firestore DocumentSnapshot of the private business profile,
 * never from a request payload or user-editable profile field.
 *
 * Firestore updateTime is converted to microseconds ONLY when its
 * nanoseconds are exactly microsecond-aligned. Reject finer precision
 * rather than silently collapsing distinct revisions. This does not
 * replace production verification of Firestore updateTime uniqueness.
 */
const {fullPrecisionRevision}=require("./phase17FullPrecisionRevision");
const MAX_SECONDS=Math.floor(Number.MAX_SAFE_INTEGER/1000000); // safe integer microseconds
function versionFromSnapshot(snapshot){
 if(!snapshot||snapshot.exists!==true||!snapshot.updateTime)
  throw Error("MISSING_TRUSTED_PROFILE_SNAPSHOT");
 const {seconds,nanoseconds}=snapshot.updateTime;
 if(!Number.isSafeInteger(seconds)||seconds<1||seconds>MAX_SECONDS||
    !Number.isSafeInteger(nanoseconds)||nanoseconds<0||nanoseconds>=1000000000)
  throw Error("INVALID_TRUSTED_UPDATE_TIME");
 if(nanoseconds%1000!==0)throw Error("SUBMICROSECOND_REVISION_NOT_REPRESENTABLE");
 const version=seconds*1000000+Math.floor(nanoseconds/1000);
 if(!Number.isSafeInteger(version)||version<1)
  throw Error("UNSAFE_TRUSTED_REVISION");
 return version;
}
function buildTrustedPublishCommand({uid,snapshot,preparePublicListing}){
 if(typeof preparePublicListing!=="function"||!snapshot||typeof snapshot.data!=="function")
  throw Error("INVALID_TRUSTED_SNAPSHOT_ADAPTER");
 const version=versionFromSnapshot(snapshot);
 const profile=snapshot.data();
 const listing=preparePublicListing(uid,profile);
 return Object.freeze({operation:"publish",uid,version,profile:listing});
}
/**
 * Migration-safe command preparation. Never silently round a source revision:
 * the existing numeric writer can only accept microsecond-aligned timestamps.
 * A full-precision token is also carried for future destination migration.
 * Submicrosecond timestamps fail closed until the destination accepts them.
 */
function buildTrustedPrecisionCommand({uid,snapshot,preparePublicListing}){
 const revision=fullPrecisionRevision(snapshot);
 const command=buildTrustedPublishCommand({uid,snapshot,preparePublicListing});
 return Object.freeze({...command,fullPrecisionRevision:revision});
}
module.exports=Object.freeze({versionFromSnapshot,buildTrustedPublishCommand,buildTrustedPrecisionCommand});
