"use strict";
/**
 * Phase 17 durable recovery state machine. Requires an injected store whose
 * put/get methods persist atomically across process restarts; this module
 * does not provide a production storage implementation or live wiring.
 * Only a trusted server-side caller may create/reconcile entries.
 */
const {safeCommand}=require("./phase17PublicationRecovery");
const STATES=new Set(["PENDING","UNKNOWN","CONFIRMED","BLOCKED"]);
function keyFor(c){return c.uid+":"+c.operation+":"+c.version;}
function validateStore(store){
 if(!store||typeof store.get!=="function"||typeof store.put!=="function")
  throw Error("DURABLE_STORE_REQUIRED");
}
function fingerprint(c){return JSON.stringify([c.operation,c.uid,c.version,c.profile||null]);}
async function prepare({store,command}){
 validateStore(store);
 const c=safeCommand(command),key=keyFor(c),hash=fingerprint(c);
 const old=await store.get(key);
 if(old){
  if(old.fingerprint!==hash)throw Error("RECOVERY_VERSION_CONFLICT");
  if(!STATES.has(old.state))throw Error("INVALID_RECOVERY_STATE");
  return old;
 }
 const entry={key,command:c,fingerprint:hash,state:"PENDING"};
 await store.put(key,entry);
 return entry;
}
async function reconcile({store,key,readCurrent,send}){
 validateStore(store);
 if(typeof readCurrent!=="function"||typeof send!=="function")throw Error("RECOVERY_ADAPTER_REQUIRED");
 const entry=await store.get(key);
 if(!entry||!STATES.has(entry.state))throw Error("UNKNOWN_RECOVERY_ENTRY");
 if(entry.state==="CONFIRMED"||entry.state==="BLOCKED")return entry;
 const current=await readCurrent(entry.command.uid);
 // Fail closed if freshness cannot be established. Never replay after
 // source deletion or if the trusted source revision changed.
 if(!current||current.version!==entry.command.version||
    current.operation!==entry.command.operation||
    current.fingerprint!==entry.fingerprint){
  const blocked={...entry,state:"BLOCKED",reason:"SOURCE_CHANGED_OR_UNVERIFIED"};
  await store.put(key,blocked);return blocked;
 }
 // Mark uncertain BEFORE calling external publisher: a crash after send
 // will require fresh source verification on the next restart.
 const unknown={...entry,state:"UNKNOWN"};
 await store.put(key,unknown);
 try{
  const result=await send(entry.command);
  if(result&&["PUBLISHED","UNPUBLISHED","ALREADY_APPLIED"].includes(result.status)){
   const confirmed={...unknown,state:"CONFIRMED",result:result.status};
   await store.put(key,confirmed);return confirmed;
  }
  if(result&&["STALE","SLUG_TAKEN","INCONSISTENT_RESERVATION"].includes(result.status)){
   const blocked={...unknown,state:"BLOCKED",reason:result.status};
   await store.put(key,blocked);return blocked;
  }
  return unknown;
 }catch(_error){
  // Do not trust an error to prove that the remote write did not happen.
  return unknown;
 }
}
module.exports=Object.freeze({prepare,reconcile,fingerprint,keyFor});
