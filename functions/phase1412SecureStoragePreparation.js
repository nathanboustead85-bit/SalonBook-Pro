"use strict";
// Phase 14.12: security-oriented storage contract, test adapter only.
// No Firestore imports, deployment, endpoints or real booking writes.
const {createHmac,timingSafeEqual}=require("node:crypto");
const {canonical}=require("./phase149IdempotencySimulator");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const ID=/^[A-Za-z0-9_-]{1,128}$/,KEY=/^[A-Za-z0-9_-]{8,128}$/;
const TTL_MS=7*24*60*60*1000;
function digest(secret,value){return createHmac("sha256",secret).update(value).digest("hex");}
function equal(a,b){return typeof a==="string"&&typeof b==="string"&&a.length===64&&b.length===64&&timingSafeEqual(Buffer.from(a,"hex"),Buffer.from(b,"hex"));}
function createSecureStoragePreparation(adapter,{secret,clock=()=>Date.now()}={}){
 if(!adapter||typeof adapter.read!=="function"||typeof adapter.createIfAbsent!=="function")throw new TypeError("test-only adapter required");
 if(typeof secret!=="string"||Buffer.byteLength(secret)<32)throw new TypeError("secret must be at least 32 bytes");
 const reply=(status)=>({status,acceptingBookings:false,reservationCreated:false});
 function identity(owner,key,intent){
  if(typeof owner!=="string"||!ID.test(owner)||typeof key!=="string"||!KEY.test(key))return null;
  const payload=canonical(intent);
  if(payload===null)return null;
  return {scope:digest(secret,JSON.stringify([owner,key])),fingerprint:digest(secret,payload)};
 }
 async function inspect(owner,key,intent){
  const id=identity(owner,key,intent);
  if(!id)return reply("SECURE_RECORD_REQUEST_INVALID");
  try{
   const record=await adapter.read(id.scope);
   if(!record)return reply("SECURE_RECORD_NOT_FOUND");
   if(!equal(record.fingerprint,id.fingerprint))return reply("IDEMPOTENCY_KEY_REUSED");
   const now=clock();
   if(record.state!=="COMMITTED_SIMULATION"||!Number.isSafeInteger(record.createdAt)
    ||!Number.isSafeInteger(now)||now<record.createdAt||now-record.createdAt>TTL_MS)
    return reply("SECURE_RECORD_OUTCOME_UNCERTAIN");
   return reply("SIMULATION_PREVIOUS_OUTCOME_FOUND");
  }catch{return reply("SECURE_RECORD_OUTCOME_UNCERTAIN");}
 }
 async function prepare(owner,key,intent){
  const id=identity(owner,key,intent);
  if(!id)return reply("SECURE_RECORD_REQUEST_INVALID");
  const now=clock();
  if(!Number.isSafeInteger(now)||now<0)return reply("SECURE_RECORD_OUTCOME_UNCERTAIN");
  try{
   const created=await adapter.createIfAbsent(id.scope,
    {fingerprint:id.fingerprint,state:"COMMITTED_SIMULATION",createdAt:now});
   return created?reply("SECURE_SIMULATION_RECORD_PREPARED"):inspect(owner,key,intent);
  }catch{return reply("SECURE_RECORD_OUTCOME_UNCERTAIN");}
 }
 return Object.freeze({prepare,inspect,reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createSecureStoragePreparation,TTL_MS});
