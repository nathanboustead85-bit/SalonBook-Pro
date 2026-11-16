"use strict";
const assert=require("node:assert/strict");
const {createSecureStoragePreparation,TTL_MS}=require("../functions/phase1412SecureStoragePreparation");
const {createInMemoryRecoveryAdapter}=require("../functions/phase1411RecoveryRecordPreparation");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const secret="this-is-a-test-only-secret-not-for-production-12345";
const now=1800000000000,owner="owner123",key="unique_request_123456";
const intent={serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"09:00"};
async function main(){
 const shared=new Map(),adapter=createInMemoryRecoveryAdapter(shared);
 const make=(time=now,s=secret)=>createSecureStoragePreparation(adapter,{secret:s,clock:()=>time});
 const first=make();
 assert.deepEqual(await first.reserve(owner,key,intent),DISABLED);
 assert.equal((await first.inspect(owner,key,intent)).status,"SECURE_RECORD_NOT_FOUND");
 assert.equal((await first.prepare(owner,key,intent)).status,"SECURE_SIMULATION_RECORD_PREPARED");
 assert.equal(shared.size,1);
 const [[scope,record]]=[...shared.entries()];
 assert.match(scope,/^[a-f0-9]{64}$/);
 assert.match(record.fingerprint,/^[a-f0-9]{64}$/);
 assert.equal(JSON.stringify([...shared]).includes(key),false,"no raw request key");
 assert.equal(JSON.stringify([...shared]).includes(owner),false,"no owner ID");
 assert.equal(JSON.stringify([...shared]).includes("2026-11-20"),false,"no booking details");
 assert.equal((await make(now+1).inspect(owner,key,intent)).status,"SIMULATION_PREVIOUS_OUTCOME_FOUND");
 assert.equal((await make(now+1).prepare(owner,key,intent)).status,"SIMULATION_PREVIOUS_OUTCOME_FOUND");
 assert.equal(shared.size,1,"repeated key creates one record");
 assert.equal((await first.prepare(owner,key,{...intent,time:"11:00"})).status,"IDEMPOTENCY_KEY_REUSED");
 assert.equal((await first.inspect("another-owner",key,intent)).status,"SECURE_RECORD_NOT_FOUND");
 assert.equal((await first.inspect(owner,"bad",intent)).status,"SECURE_RECORD_REQUEST_INVALID");
 assert.equal((await make(now+TTL_MS+1).inspect(owner,key,intent)).status,"SECURE_RECORD_OUTCOME_UNCERTAIN");
 assert.equal((await make(now,secret+"-rotated").inspect(owner,key,intent)).status,"SECURE_RECORD_NOT_FOUND",
  "key rotation needs a planned migration");
 assert.throws(()=>createSecureStoragePreparation(adapter,{secret:"weak"}),/secret/);
 const offline=createSecureStoragePreparation({
  async read(){throw Error("offline");},async createIfAbsent(){throw Error("offline");}
 },{secret,clock:()=>now});
 assert.equal((await offline.inspect(owner,key,intent)).status,"SECURE_RECORD_OUTCOME_UNCERTAIN");
 assert.equal((await offline.prepare(owner,key,intent)).status,"SECURE_RECORD_OUTCOME_UNCERTAIN");
 console.log("PASS Phase 14.12 HMAC identifiers, no raw data, isolation, duplicate recovery, expiry and offline; no cloud writes");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
