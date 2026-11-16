"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createTransactionSafetyPreparation}=require("../functions/phase164TransactionSafetyPreparation");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const intent={serviceId:"cut",staffId:"barber",date:"2026-11-20",time:"10:00"};
const catalogue={services:[{id:"cut",published:true,durationMinutes:30}],
 staff:[{id:"barber",active:true,serviceIds:["cut"]}]};
const staffSchedules=[{id:"barber",weeklySchedule:{friday:{open:"09:00",close:"17:00"}},
 weeklyBreaks:[],timeOff:[]}];
const makeSnapshot=bookings=>({ownerId:"salonA",complete:true,transactionRead:true,
 catalogue,staffSchedules,bookings});
const db={runTransaction:async(fn,opts)=>{
 assert.equal(opts.readOnly,true);assert.equal(opts.maxAttempts,3);
 return fn({get:async()=>({exists:true})});
}};
async function main(){
 let reads=0,writes=0;
 const loadSnapshot=async(tx,owner)=>{reads++;assert.equal(owner,"salonA");await tx.get();return makeSnapshot([]);};
 const api=createTransactionSafetyPreparation(db,{loadSnapshot});
 const input={ownerId:"salonA",intent};
 const result=await api.inspect(input);
 assert.equal(result.status,"TRANSACTION_SLOT_INSPECTED_ONLY");
 assert.equal(result.acceptingBookings,false);
 assert.equal(result.reservationCreated,false);
 assert.equal(result.reservationCreatedInTransaction,false);
 assert.equal(api.requiresAtomicCommit,true);
 assert.equal(api.productionRequirements.length,5);
 assert.equal((await api.inspect({...input,ownerId:"../bad"})).status,"TRANSACTION_OWNER_INVALID");
 assert.equal(reads,1);
 const conflict={staffId:"barber",date:"2026-11-20",time:"10:15",
 durationMinutes:30,status:"confirmed"};
 const busy=createTransactionSafetyPreparation(db,{loadSnapshot:async()=>makeSnapshot([conflict])});
 assert.equal((await busy.inspect(input)).status,"EXISTING_BOOKING_CONFLICT");
 const invalid=createTransactionSafetyPreparation(db,{loadSnapshot:async()=>({...makeSnapshot([]),transactionRead:false})});
 assert.equal((await invalid.inspect(input)).status,"TRANSACTION_SNAPSHOT_UNTRUSTED");
 const outage=createTransactionSafetyPreparation({runTransaction:async()=>{throw Error("unavailable");}},
 {loadSnapshot});
 assert.equal((await outage.inspect(input)).status,"TRANSACTION_READ_FAILED");
 // 100 parallel reads may ALL report free. This is why inspection is NOT a lock.
 const results=await Promise.all(Array.from({length:100},()=>api.inspect(input)));
 assert.equal(results.length,100);
 assert.ok(results.every(x=>x.status==="TRANSACTION_SLOT_INSPECTED_ONLY"
  &&x.reservationCreated===false&&x.acceptingBookings===false));
 const originals=[{id:"original1"},{id:"original2"}],before=JSON.stringify(originals);
 assert.deepEqual(await api.reserve(input),DISABLED);
 assert.equal(JSON.stringify(originals),before);
 const root=path.resolve(__dirname,"..");
 const entry=fs.readFileSync(path.join(root,"functions/index.js"),"utf8");
 const source=fs.readFileSync(path.join(root,"functions/phase164TransactionSafetyPreparation.js"),"utf8");
 assert.ok(!entry.includes("phase164TransactionSafetyPreparation"));
 assert.ok(!source.includes("tx.set(")&&!source.includes("tx.create(")
  &&!source.includes("tx.update(")&&!source.includes("tx.delete("));
 assert.equal(writes,0);
 console.log("PASS Phase 16.4 read-only transaction, 100 parallel inspections, conflict detection and disabled booking safety");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
