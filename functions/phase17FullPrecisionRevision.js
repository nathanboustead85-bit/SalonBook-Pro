"use strict";
/**
 * Exact, lossless Firestore updateTime token for future revision migration.
 * Does NOT replace the existing numeric publicationVersion contract.
 * Trusted server snapshot only; never accept client-provided timestamps.
 */
function fullPrecisionRevision(snapshot){
 if(!snapshot||snapshot.exists!==true||!snapshot.updateTime)throw Error("MISSING_TRUSTED_PROFILE_SNAPSHOT");
 const {seconds,nanoseconds}=snapshot.updateTime;
 if(!Number.isSafeInteger(seconds)||seconds<1||!Number.isSafeInteger(nanoseconds)||nanoseconds<0||nanoseconds>=1000000000)
  throw Error("INVALID_TRUSTED_UPDATE_TIME");
 return seconds.toString().padStart(16,"0")+":"+nanoseconds.toString().padStart(9,"0");
}
function compareRevisions(a,b){
 const pattern=/^\d{16}:\d{9}$/;
 if(typeof a!=="string"||typeof b!=="string"||!pattern.test(a)||!pattern.test(b))
  throw Error("INVALID_FULL_PRECISION_REVISION");
 return a===b?0:a<b?-1:1;
}
module.exports=Object.freeze({fullPrecisionRevision,compareRevisions});
