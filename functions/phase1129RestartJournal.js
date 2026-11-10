"use strict";
/** Phase 11.29 synthetic restart journal. Injected storage only; never exported by production functions. */
const {guard}=require("./phase113DemoBookingEngine");
const {validateRequest,projectSnapshot}=require("./phase1115CloudCalendarContract");
const {createMultiDeviceCalendar}=require("./phase1127MultiDeviceCalendar");
const clone=x=>JSON.parse(JSON.stringify(x));
function createRestartJournal({request,storage,initial,revision=0}){
 guard();
 const valid=validateRequest(request);
 if(!storage||typeof storage.read!=="function"||typeof storage.write!=="function")throw Error("invalid journal storage");
 const identity=JSON.stringify([valid.businessId,valid.date]);
 let persisted=storage.read();
 if(persisted!==null&&persisted!==undefined){
  if(persisted.version!==1||persisted.identity!==identity||!Array.isArray(persisted.pending)||
    !Number.isSafeInteger(persisted.revision)||persisted.revision<0)throw Error("invalid journal checkpoint");
  persisted.snapshot=projectSnapshot(valid,persisted.snapshot);
  for(const entry of persisted.pending){
   if(!entry||typeof entry.deviceId!=="string"||typeof entry.operationId!=="string"||
      !Number.isSafeInteger(entry.baseRevision))throw Error("invalid pending operation");
   entry.snapshot=projectSnapshot(valid,entry.snapshot);
  }
 }else{
  persisted={version:1,identity,revision,snapshot:projectSnapshot(valid,initial),pending:[]};
  storage.write(clone(persisted));
 }
 let journal=clone(persisted);
 const persist=next=>{storage.write(clone(next));journal=clone(next);};
 function queue(operation){
  guard();
  if(!operation||typeof operation.deviceId!=="string"||! /^[a-zA-Z0-9_-]{1,64}$/.test(operation.deviceId)||
     typeof operation.operationId!=="string"||! /^[a-zA-Z0-9_-]{1,64}$/.test(operation.operationId)||
     !Number.isSafeInteger(operation.baseRevision)||operation.baseRevision<0)throw Error("invalid pending operation");
  const normalized={deviceId:operation.deviceId,operationId:operation.operationId,baseRevision:operation.baseRevision,snapshot:projectSnapshot(valid,operation.snapshot)};
  const existing=journal.pending.find(p=>p.deviceId===normalized.deviceId&&p.operationId===normalized.operationId);
  if(existing){
   if(JSON.stringify(existing)!==JSON.stringify(normalized))throw Error("operation replay conflict");
   return "duplicate";
  }
  if(journal.pending.length>=32)throw Error("journal capacity reached");
  persist({...journal,pending:[...journal.pending,normalized]});
  return "queued";
 }
 function recover(authoritative){
  guard();
  if(!authoritative||!Number.isSafeInteger(authoritative.revision)||authoritative.revision<0)throw Error("invalid authoritative revision");
  const snapshot=projectSnapshot(valid,authoritative.snapshot);
  if(authoritative.revision<journal.revision)throw Error("authoritative rollback rejected");
  const server=createMultiDeviceCalendar({request:valid,initial:snapshot,revision:authoritative.revision});
  const pending=journal.pending.slice();
  const results=[];
  for(const operation of pending){
   const result=server.submit(operation);
   results.push(result.outcome);
   if(result.outcome!=="applied"&&result.outcome!=="duplicate")break;
  }
  const applied=results.filter(x=>x==="applied").length;
  const accepted=results.filter(x=>x==="applied"||x==="duplicate").length;
  const current=server.state();
  // A rejected operation remains queued; never silently rewrite its base revision.
  persist({...journal,revision:current.revision,snapshot:current.snapshot,pending:pending.slice(accepted)});
  return {outcomes:results,applied,pending:journal.pending.length,revision:journal.revision};
 }
 function status(){guard();return clone(journal);}
 return Object.freeze({queue,recover,status});
}
module.exports={createRestartJournal};
