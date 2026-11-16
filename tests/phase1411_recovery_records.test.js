"use strict";
const assert=require("node:assert/strict");
const {createRecoveryRecordPreparation,createInMemoryRecoveryAdapter,MAX_AGE}=
 require("../functions/phase1411RecoveryRecordPreparation");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const now=1800000000000;
const a={serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"09:00"};
const key="persistent_request_1234";
async function main(){
 const shared=new Map(),adapter=createInMemoryRecoveryAdapter(shared);
 const first=createRecoveryRecordPreparation(adapter,{clock:()=>now});
 assert.deepEqual(await first.reserve("owner",key,a),DISABLED);
 assert.equal((await first.recover("owner",key,a)).status,"RECOVERY_NOT_FOUND");
 assert.equal((await first.prepareRecord("owner",key,a)).status,"SIMULATION_RECOVERY_RECORD_PREPARED");
 assert.equal(shared.size,1);
 const restarted=createRecoveryRecordPreparation(createInMemoryRecoveryAdapter(shared),{clock:()=>now+1000});
 assert.equal((await restarted.recover("owner",key,a)).status,"SIMULATION_PREVIOUS_OUTCOME_FOUND",
  "new instance recovers shared simulated record");
 assert.equal((await restarted.prepareRecord("owner",key,a)).status,"SIMULATION_PREVIOUS_OUTCOME_FOUND",
  "same key cannot create second record");
 assert.equal(shared.size,1);
 assert.equal((await restarted.recover("owner",key,{...a,time:"11:00"})).status,"IDEMPOTENCY_KEY_REUSED");
 assert.equal((await restarted.recover("../owner",key,a)).status,"RECOVERY_REQUEST_INVALID");
 assert.equal((await restarted.recover("other",key,a)).status,"RECOVERY_NOT_FOUND",
  "owner scopes recovery");
 const expired=createRecoveryRecordPreparation(adapter,{clock:()=>now+MAX_AGE+1});
 assert.equal((await expired.recover("owner",key,a)).status,"RECOVERY_OUTCOME_UNCERTAIN",
  "expired outcomes never imply failure");
 const offline=createRecoveryRecordPreparation({
  async read(){throw Error("offline");},async createIfAbsent(){throw Error("offline");}
 },{clock:()=>now});
 assert.equal((await offline.recover("owner",key,a)).status,"RECOVERY_OUTCOME_UNCERTAIN");
 assert.equal((await offline.prepareRecord("owner",key,a)).status,"RECOVERY_OUTCOME_UNCERTAIN");
 assert.equal(shared.size,1);
 console.log("PASS Phase 14.11 restart-safe recovery record contract, scope, expiry and offline safety; no cloud writes");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
