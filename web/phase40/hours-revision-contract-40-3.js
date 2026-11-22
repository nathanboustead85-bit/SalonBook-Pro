"use strict";
// Proposal-only v2 contract over synthetic snapshots; never migrates Android v1.
const DAYS=["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
const object=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const time=x=>typeof x==="string"&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(x);
const minutes=x=>Number(x.slice(0,2))*60+Number(x.slice(3));
const reject=reason=>Object.freeze({status:"UNAVAILABLE",reason,canBook:false,canPay:false,canMessage:false,canDeploy:false,migrationReady:false,availabilityVerified:false});
function inspectHours(hours){
 if(!object(hours)||Object.keys(hours).length!==7||Object.keys(hours).some(x=>!DAYS.includes(x)))return reject("invalid_business_days");
 for(const day of DAYS){
  const periods=hours[day];
  if(!Array.isArray(periods)||periods.length>3)return reject("invalid_business_periods");
  let previous=-1;
  for(const period of periods){
   if(!object(period)||Object.keys(period).sort().join(",")!=="close,open"||!time(period.open)||!time(period.close))return reject("invalid_business_period");
   const start=minutes(period.open),end=minutes(period.close);
   if(start>=end||start<previous)return reject("overlapping_or_invalid_business_hours");
   previous=end;
  }
 }
 return Object.freeze({status:"HOURS_SCHEMA_VALID",availabilityVerified:false});
}
function inspectSharedRevision({ownerUid,documents,hours}={}){
 if(typeof ownerUid!=="string"||!/^[A-Za-z0-9_-]{1,80}$/.test(ownerUid)||!object(documents)||Object.keys(documents).sort().join(",")!=="profile,services,staff")return reject("invalid_revision_context");
 const checked=inspectHours(hours);
 if(checked.status!=="HOURS_SCHEMA_VALID")return checked;
 const entries=Object.values(documents);
 if(entries.some(x=>!object(x)||x.ownerUid!==ownerUid||x.schemaVersion!==2||!Number.isSafeInteger(x.sharedRevision)||x.sharedRevision<1||typeof x.snapshotId!=="string"||!/^[A-Za-z0-9_-]{8,80}$/.test(x.snapshotId)))return reject("invalid_revision_envelope");
 const [first]=entries;
 if(entries.some(x=>x.sharedRevision!==first.sharedRevision||x.snapshotId!==first.snapshotId))return reject("mixed_cross_device_revision");
 return Object.freeze({status:"CONTRACT_COMPATIBLE_READ_ONLY",sharedRevision:first.sharedRevision,snapshotId:first.snapshotId,businessHoursStatus:"SCHEMA_VALID_ONLY",canBook:false,canPay:false,canMessage:false,canDeploy:false,migrationReady:false,availabilityVerified:false});
}
module.exports=Object.freeze({inspectHours,inspectSharedRevision});
