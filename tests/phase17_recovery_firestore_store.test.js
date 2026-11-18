"use strict";
const assert=require("node:assert/strict");
const {createRecoveryStore,COLLECTION}=require("../functions/phase17RecoveryFirestoreStore");
const rows=new Map();
const db={
 collection(name){assert.equal(name,COLLECTION);return {doc:id=>({id,get:async()=>({exists:rows.has(id),data:()=>structuredClone(rows.get(id))})})};},
 async runTransaction(fn){
  const writes=[];
  const tx={
   get:async ref=>({exists:rows.has(ref.id),data:()=>structuredClone(rows.get(ref.id))}),
   create:(ref,data)=>writes.push(["create",ref.id,structuredClone(data)]),
   update:(ref,data)=>writes.push(["update",ref.id,structuredClone(data)])
  };
  const result=await fn(tx);
  for(const [op,key,value] of writes){
   if(op==="create"&&rows.has(key))throw Error("ALREADY_EXISTS");
   rows.set(key,value);
  }
  return result;
 }
};
const entry={key:"owner_1:publish:12",fingerprint:"abc",state:"PENDING",command:{uid:"owner_1",version:12,operation:"publish",profile:{acceptingBookings:false}}};
(async()=>{
 assert.throws(()=>createRecoveryStore({db:{}}),/TRUSTED_TRANSACTIONAL_DATABASE_REQUIRED/);
 const store=createRecoveryStore({db});
 assert.equal(await store.get(entry.key),null);
 await store.put(entry.key,entry);
 assert.equal((await store.get(entry.key)).state,"PENDING");
 await assert.rejects(()=>store.put(entry.key,{...entry,fingerprint:"different"}),/RECOVERY_VERSION_CONFLICT/);
 await store.put(entry.key,{...entry,state:"UNKNOWN"});
 await assert.rejects(()=>store.put(entry.key,entry),/RECOVERY_STATE_REGRESSION/);
 await store.put(entry.key,{...entry,state:"CONFIRMED"});
 await assert.rejects(()=>store.put(entry.key,{...entry,state:"BLOCKED"}),/RECOVERY_TERMINAL_STATE_IMMUTABLE/);
 assert.equal((await store.get(entry.key)).state,"CONFIRMED");
 await assert.rejects(()=>store.put("other:publish:12",entry),/INVALID_RECOVERY_JOURNAL_ENTRY/);
 await assert.rejects(()=>store.put("owner_1:publish:13",{...entry,key:"owner_1:publish:13",state:"CONFIRMED"}),/RECOVERY_MUST_START_PENDING/);
 await assert.rejects(()=>store.put("owner_1:publish:14",{...entry,key:"owner_1:publish:14",state:"PENDING",command:{...entry.command,profile:{acceptingBookings:true}}}),/RECOVERY_BOOKINGS_MUST_BE_DISABLED/);
 console.log("PASS PHASE17_RECOVERY_FIRESTORE_STORE: transaction create, conflict guard, state transitions, terminal immutability, bookings disabled");
 console.log("OFFLINE_FAKE_DATABASE_ONLY_NO_FIREBASE_INIT_NO_DEPLOYMENT_NO_LIVE_WRITES");
})().catch(e=>{console.error(e);process.exitCode=1;});
