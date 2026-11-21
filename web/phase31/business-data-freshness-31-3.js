"use strict";
// Phase 31.3: fail-closed, offline freshness gate for authorized published snapshots.
// No implicit clock, persistence, Firebase access, booking submission or stale fallback.
const {mapPublishedBusiness}=require("./business-data-mapper-31-2");
const unavailable=(reason)=>Object.freeze({status:"UNAVAILABLE",reason,bookingEnabled:false,profile:null});
function validateEnvelope(envelope,expectedSlug,now,{maxAgeMs=300000}={}){
 if(!envelope||typeof envelope!=="object"||Array.isArray(envelope))return unavailable("missing_snapshot");
 if(!Number.isSafeInteger(now)||now<0||!Number.isSafeInteger(maxAgeMs)||maxAgeMs<1||maxAgeMs>3600000)return unavailable("invalid_clock_or_policy");
 if(envelope.schemaVersion!==1||envelope.catalogueVersion!==1)return unavailable("unsupported_version");
 if(!Number.isSafeInteger(envelope.revision)||envelope.revision<1)return unavailable("invalid_revision");
 if(!Number.isSafeInteger(envelope.generatedAt)||envelope.generatedAt<=0||
 envelope.generatedAt>now||now-envelope.generatedAt>maxAgeMs)return unavailable("stale_or_future_snapshot");
 if(!envelope.profile||!envelope.catalogue)return unavailable("incomplete_snapshot");
 if(envelope.profileRevision!==envelope.revision||envelope.catalogueRevision!==envelope.revision)return unavailable("mixed_revisions");
 const mapped=mapPublishedBusiness(envelope.profile,envelope.catalogue,expectedSlug);
 if(mapped.status!=="READ_ONLY_DISPLAY")return unavailable("invalid_business_data");
 return Object.freeze({...mapped,status:"FRESH_READ_ONLY",revision:envelope.revision,generatedAt:envelope.generatedAt,
  expiresAt:envelope.generatedAt+maxAgeMs,bookingEnabled:false});
}
// A failed refresh must never silently return cached data. Explicit recovery requires
// a newly validated snapshot with a strictly higher revision than last accepted.
function recoverSnapshot(envelope,expectedSlug,now,lastRevision,options){
 if(!Number.isSafeInteger(lastRevision)||lastRevision<0)return unavailable("invalid_previous_revision");
 const next=validateEnvelope(envelope,expectedSlug,now,options);
 if(next.status!=="FRESH_READ_ONLY")return next;
 if(next.revision<=lastRevision)return unavailable("replayed_or_older_revision");
 return next;
}
module.exports=Object.freeze({validateEnvelope,recoverSnapshot});
