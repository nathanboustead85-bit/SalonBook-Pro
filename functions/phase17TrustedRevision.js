"use strict";
/**
 * Phase 17 trusted revision derivation. The updateTime MUST come from the
 * server-side Firestore DocumentSnapshot of the private business profile,
 * never from a request payload or user-editable profile field.
 *
 * Firestore updateTime nanoseconds are truncated to microseconds. If two
 * changes share one microsecond, they cannot safely be ordered by this
 * scheme; production must reject that ambiguity or use an explicit
 * server-maintained monotonic revision before deployment.
 */
const MAX_SECONDS=8640000000; // within JS safe microsecond integer range
function versionFromSnapshot(snapshot){
 if(!snapshot||snapshot.exists!==true||!snapshot.updateTime)
  throw Error("MISSING_TRUSTED_PROFILE_SNAPSHOT");
 const {seconds,nanoseconds}=snapshot.updateTime;
 if(!Number.isSafeInteger(seconds)||seconds<1||seconds>MAX_SECONDS||
    !Number.isSafeInteger(nanoseconds)||nanoseconds<0||nanoseconds>=1000000000)
  throw Error("INVALID_TRUSTED_UPDATE_TIME");
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
module.exports=Object.freeze({versionFromSnapshot,buildTrustedPublishCommand});
