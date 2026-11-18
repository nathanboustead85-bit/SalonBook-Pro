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
function createRecoveryStore({db}){
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
  put:async(key,entry)=>{
   assertEntry(key,entry);
   const ref=doc(key);
   return db.runTransaction(async tx=>{
    const snap=await tx.get(ref);
    if(!snap.exists){
     if(entry.state!=="PENDING")throw Error("RECOVERY_MUST_START_PENDING");
     tx.create(ref,entry);
     return entry;
    }
    const previous=snap.data();
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
    tx.update(ref,entry);
    return entry;
   });
  }
 });
}
module.exports=Object.freeze({createRecoveryStore,COLLECTION});
