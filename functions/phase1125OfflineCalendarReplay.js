"use strict";
/** Phase 11.25: bounded synthetic offline replay queue. Emulator-only; no production exports. */
const {guard}=require("./phase113DemoBookingEngine");
const {createIdempotentCalendarSync}=require("./phase1124IdempotentCalendarSync");
function createOfflineCalendarReplay({request,initial,revision=0,maxPending=100}){
 guard();
 if(!Number.isSafeInteger(maxPending)||maxPending<1||maxPending>1000)throw Error("invalid queue limit");
 const sync=createIdempotentCalendarSync({request,initial,revision});
 let pending=[];
 function enqueue(update){
  guard();
  if(!update||typeof update!=="object"||Array.isArray(update)||!Number.isSafeInteger(update.revision)||update.revision<0||!update.snapshot)throw Error("invalid queued update");
  // Snapshot the input so callers cannot mutate queued content after enqueue.
  const copy=JSON.parse(JSON.stringify(update));
  if(pending.length>=maxPending)throw Error("offline queue full");
  pending.push(copy);
  return pending.length;
 }
 function flush(){
  guard();
  if(!pending.length)return Object.freeze({applied:0,duplicates:0,...sync.state(),pending:0});
  // Atomic batch: failed replay retains every pending update for safe retry.
  const result=sync.applyBatch(pending);
  pending=[];
  return Object.freeze({...result,pending:0});
 }
 return Object.freeze({
  enqueue,flush,
  state(){guard();return Object.freeze({...sync.state(),pending:pending.length});},
  discardPending(){guard();const count=pending.length;pending=[];return count;}
 });
}
module.exports={createOfflineCalendarReplay};
