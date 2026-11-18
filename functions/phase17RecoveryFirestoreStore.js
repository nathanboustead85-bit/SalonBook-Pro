"use strict";
/**
 * Phase 17 server-only recovery journal adapter (OFFLINE PREPARATION).
 * Inject a Firestore-like database; never initialise Firebase here.
 * Transactions prevent conflicting initial creates and terminal state rewrites.
 * This is not yet wired to the recovery state machine in production.
 * Do not use with a public customer-readable collection.
 */
const COLLECTION="publicationRecoveryJournal";
const STATES=new Set(["PENDING","UNKNOWN","CONFIRMED","BLOCKED"]);
const TERMINAL=new Set(["CONFIRMED","BLOCKED"]);
const {preparePublicListing}=require("./phase17PublicListingProjection");
function assertStrictEntry(entry){
 const c=entry.command;
 if(!c||!["publish","unpublish"].includes(c.operation)||
    !Number.isSafeInteger(c.version)||c.version<1||
    entry.key!==c.uid+":"+c.operation+":"+c.version)
  throw Error("STRICT_RECOVERY_KEY_MISMATCH");
 if(c.operation==="publish"){
  const projected=preparePublicListing(c.uid,c.profile);
  const allowed=Object.keys(projected);
  if(Object.keys(c.profile).some(k=>!allowed.includes(k))||
     allowed.some(k=>c.profile[k]!==projected[k]))
   throw Error("PRIVATE_OR_UNCANONICAL_JOURNAL_PROFILE");
 }else if(c.profile!==undefined&&c.profile!==null){
  throw Error("UNPUBLISH_JOURNAL_PROFILE_FORBIDDEN");
 }
}
function assertEntry(key,entry){
 if(typeof key!=="string"||!/^[-_A-Za-z0-9:]{1,300}$/.test(key)||
 !entry||entry.key!==key||!STATES.has(entry.state)||
 typeof entry.fingerprint!=="string"||!entry.fingerprint||
 !entry.command||typeof entry.command.uid!=="string"||
 !key.startsWith(entry.command.uid+":"))
 throw Error("INVALID_RECOVERY_JOURNAL_ENTRY");
 if(entry.command.profile&&entry.command.profile.acceptingBookings!==false)
 throw Error("RECOVERY_BOOKINGS_MUST_BE_DISABLED");
}
function createRecoveryStore({db,strict=false}){
 if(!db||typeof db.collection!=="function"||typeof db.runTransaction!=="function")
 throw Error("TRUSTED_TRANSACTIONAL_DATABASE_REQUIRED");
 const collection=db.collection(COLLECTION);
 if(!collection||typeof collection.doc!=="function")throw Error("INVALID_JOURNAL_COLLECTION");
 function doc(key){
  if(typeof key!=="string"||!/^[-_A-Za-z0-9:]{1,300}$/.test(key))throw Error("INVALID_JOURNAL_KEY");
  return collection.doc(key);
 }
 return Object.freeze({
  get:async key=>{
   const snap=await doc(key).get();
   return snap.exists?snap.data():null;
  },
  put:async(key,entry,expectedRevision)=>{
   if(expectedRevision!==undefined&&(!Number.isSafeInteger(expectedRevision)||expectedRevision<0))throw Error("INVALID_EXPECTED_REVISION");
   assertEntry(key,entry);
   if(strict){
    if(expectedRevision===undefined)throw Error("RECOVERY_CAS_REQUIRED");
    assertStrictEntry(entry);
   }
   const ref=doc(key);
   return db.runTransaction(async tx=>{
    const snap=await tx.get(ref);
    if(!snap.exists){
     if(expectedRevision!==undefined&&expectedRevision!==0)throw Error("RECOVERY_REVISION_CONFLICT");
     if(entry.state!=="PENDING")throw Error("RECOVERY_MUST_START_PENDING");
     const created={...entry,revision:1};
     tx.create(ref,created);
     return created;
    }
    const previous=snap.data();
    const revision=previous.revision===undefined?1:previous.revision;
    if(expectedRevision!==undefined&&expectedRevision!==revision)throw Error("RECOVERY_REVISION_CONFLICT");
    if(previous.fingerprint!==entry.fingerprint||
       previous.command.uid!==entry.command.uid||
       previous.command.version!==entry.command.version||
       previous.command.operation!==entry.command.operation)
     throw Error("RECOVERY_VERSION_CONFLICT");
    if(TERMINAL.has(previous.state)){
     if(previous.state!==entry.state)throw Error("RECOVERY_TERMINAL_STATE_IMMUTABLE");
     return previous;
    }
    if(previous.state==="UNKNOWN"&&entry.state==="PENDING")
     throw Error("RECOVERY_STATE_REGRESSION");
    if(previous.state==="PENDING"&&!["PENDING","UNKNOWN","BLOCKED"].includes(entry.state))
     throw Error("RECOVERY_INVALID_TRANSITION");
    const next={...entry,revision:revision+1};
    tx.update(ref,next);
    return next;
   });
  }
 });
}
module.exports=Object.freeze({createRecoveryStore,COLLECTION});
