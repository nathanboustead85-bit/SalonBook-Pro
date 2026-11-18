"use strict";
/**
 * Offline-only strict recovery state machine. Requires createRecoveryStore({db,strict:true}).
 * CAS protects journal transitions, not remote publication. Production still
 * requires authoritative source authentication and destination fencing.
 */
const {safeCommand}=require("./phase17PublicationRecovery");
const {preparePublicListing}=require("./phase17PublicListingProjection");
const {fingerprint,keyFor}=require("./phase17DurableRecovery");
function canonical(command){
 const c=safeCommand(command);
 if(c.operation==="unpublish"){
  if(c.profile!==undefined&&c.profile!==null)throw Error("UNPUBLISH_PROFILE_FORBIDDEN");
  return {uid:c.uid,version:c.version,operation:c.operation};
 }
 const profile=preparePublicListing(c.uid,c.profile);
 if(Object.keys(c.profile).some(k=>!Object.hasOwn(profile,k))||
    Object.keys(c.profile).some(k=>c.profile[k]!==profile[k]))
  throw Error("PRIVATE_OR_UNCANONICAL_JOURNAL_PROFILE");
 return {uid:c.uid,version:c.version,operation:c.operation,profile};
}
function validate(store){
 if(!store||typeof store.get!=="function"||typeof store.put!=="function")throw Error("STRICT_RECOVERY_STORE_REQUIRED");
}
async function prepareStrict({store,command}){
 validate(store);
 const c=canonical(command),key=keyFor(c),hash=fingerprint(c);
 const existing=await store.get(key);
 if(existing){
  if(existing.fingerprint!==hash)throw Error("RECOVERY_VERSION_CONFLICT");
  return existing;
 }
 try{return await store.put(key,{key,command:c,fingerprint:hash,state:"PENDING"},0);}
 catch(e){
  if(e.message!=="RECOVERY_REVISION_CONFLICT")throw e;
  const winner=await store.get(key);
  if(!winner||winner.fingerprint!==hash)throw Error("RECOVERY_VERSION_CONFLICT");
  return winner;
 }
}
async function reconcileStrict({store,key,readCurrent,send}){
 validate(store);
 if(typeof readCurrent!=="function"||typeof send!=="function")throw Error("STRICT_RECOVERY_ADAPTER_REQUIRED");
 const entry=await store.get(key);
 if(!entry||!Number.isSafeInteger(entry.revision)||entry.revision<1)throw Error("INVALID_STRICT_RECOVERY_ENTRY");
 if(["CONFIRMED","BLOCKED"].includes(entry.state))return entry;
 if(!["PENDING","UNKNOWN"].includes(entry.state))throw Error("INVALID_STRICT_RECOVERY_STATE");
 const current=await readCurrent(entry.command.uid);
 if(!current||current.version!==entry.command.version||
    current.operation!==entry.command.operation||current.fingerprint!==entry.fingerprint){
  return store.put(key,{...entry,state:"BLOCKED",reason:"SOURCE_CHANGED_OR_UNVERIFIED"},entry.revision);
 }
 // CAS first: a competing reconciler cannot pass this boundary with the
 // same revision. UNKNOWN is allowed to retry after source verification.
 const uncertain=await store.put(key,{...entry,state:"UNKNOWN"},entry.revision);
 let result;
 try{result=await send(entry.command);}
 catch(_e){return uncertain;}
 let next;
 if(result&&["PUBLISHED","UNPUBLISHED","ALREADY_APPLIED"].includes(result.status))
  next={...uncertain,state:"CONFIRMED",result:result.status};
 else if(result&&["STALE","SLUG_TAKEN","INCONSISTENT_RESERVATION","VERSION_CONFLICT"].includes(result.status))
  next={...uncertain,state:"BLOCKED",reason:result.status};
 else return uncertain;
 try{return await store.put(key,next,uncertain.revision);}
 catch(e){
  if(e.message!=="RECOVERY_REVISION_CONFLICT")throw e;
  // Never overwrite another worker's outcome after an external send.
  return {status:"JOURNAL_CONFLICT_REQUIRES_RECONCILIATION"};
 }
}
module.exports=Object.freeze({prepareStrict,reconcileStrict});
