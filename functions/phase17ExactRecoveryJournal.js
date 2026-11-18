"use strict";
/**
 * Offline exact-revision journal, separate from legacy numeric recovery.
 * Uses one transaction per journal mutation; no remote publication or Firebase.
 * A trusted server-side reader must construct identity from a real snapshot.
 */
const {exactPublicationIdentity,verifyExactIdentity}=require("./phase17ExactPublicationIdentity");
const COLLECTION="publicationExactRecoveryJournal";
const TERMINAL=new Set(["CONFIRMED","BLOCKED"]);
const STATES=new Set(["PENDING","UNKNOWN","CONFIRMED","BLOCKED"]);
function createExactJournal({db}){
 if(!db||typeof db.collection!=="function"||typeof db.runTransaction!=="function")
  throw Error("EXACT_JOURNAL_TRANSACTIONAL_DATABASE_REQUIRED");
 const col=db.collection(COLLECTION);
 const refFor=key=>{
  if(typeof key!=="string"||!/^[A-Za-z0-9_-]{1,128}:(?:publish|unpublish):\d{16}:\d{9}$/.test(key))
   throw Error("INVALID_EXACT_JOURNAL_KEY");
  return col.doc(key);
 };
 const read=async key=>{
  const snap=await refFor(key).get();
  return snap.exists?snap.data():null;
 };
 async function prepare({uid,operation,snapshot,profile}){
  const identity=exactPublicationIdentity({uid,operation,snapshot,profile});
  const ref=refFor(identity.key);
  return db.runTransaction(async tx=>{
   const snap=await tx.get(ref);
   if(snap.exists){
    const existing=snap.data();
    if(existing.digest!==identity.digest||existing.revision!==identity.revision)
     throw Error("EXACT_JOURNAL_IDENTITY_CONFLICT");
    return existing;
   }
   const entry={key:identity.key,digest:identity.digest,uid,operation,revision:identity.revision,state:"PENDING",casRevision:1};
   tx.create(ref,entry);
   return entry;
  });
 }
 async function transition({key,digest,expectedRevision,state,sourceSnapshot}){
  if(!STATES.has(state)||!Number.isSafeInteger(expectedRevision)||expectedRevision<1)
   throw Error("INVALID_EXACT_JOURNAL_TRANSITION");
  const ref=refFor(key);
  return db.runTransaction(async tx=>{
   const snap=await tx.get(ref);
   if(!snap.exists)throw Error("EXACT_JOURNAL_NOT_FOUND");
   const old=snap.data();
   if(old.digest!==digest)throw Error("EXACT_JOURNAL_IDENTITY_CONFLICT");
   if(old.casRevision!==expectedRevision)throw Error("EXACT_JOURNAL_CAS_CONFLICT");
   if(TERMINAL.has(old.state)){
    if(old.state!==state)throw Error("EXACT_JOURNAL_TERMINAL_IMMUTABLE");
    return old;
   }
   if(state==="PENDING"||old.state==="PENDING"&&state==="CONFIRMED")
    throw Error("EXACT_JOURNAL_INVALID_TRANSITION");
   if(state!=="BLOCKED"){
    if(!sourceSnapshot||!verifyExactIdentity({revision:old.revision},sourceSnapshot))
     throw Error("EXACT_JOURNAL_SOURCE_NOT_CURRENT");
   }
   const next={...old,state,casRevision:old.casRevision+1};
   tx.update(ref,next);
   return next;
  });
 }
 return Object.freeze({prepare,read,transition});
}
module.exports=Object.freeze({createExactJournal,COLLECTION});
