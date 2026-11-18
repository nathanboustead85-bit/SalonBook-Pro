"use strict";
const assert=require("node:assert/strict");
const {planExactRecovery}=require("../functions/phase17ExactRecoveryPlanner");
const {exactPublicationIdentity}=require("../functions/phase17ExactPublicationIdentity");
const uid="owner_1",snap=n=>({exists:true,updateTime:{seconds:1763450000,nanoseconds:n}});
for(const operation of ["publish","unpublish"]){
 const profile={businessId:uid,name:"Demo Salon",slug:"demo-salon",category:"Hair",phone:"",address:"",description:""};
 const args={uid,operation,snapshot:snap(123456001),...(operation==="publish"?{profile}:{})};
 const identity=exactPublicationIdentity(args);
 const journal={key:identity.key,digest:identity.digest,revision:identity.revision,uid,operation,casRevision:1,state:"UNKNOWN"};
 const workerClaim={key:identity.key,digest:identity.digest,worker:"worker1",generation:1,state:"HELD"};
 const input={identity,journal,sourceSnapshot:snap(123456001),claimPlacement:"destination-transaction",workerClaim};
 assert.equal(planExactRecovery(input).status,"READY_FOR_DESTINATION_RECHECK");
 assert.equal(planExactRecovery({...input,claimPlacement:"private-database"}).status,"UNSAFE_CLAIM_PLACEMENT");
 assert.equal(planExactRecovery({...input,sourceSnapshot:snap(123456002)}).status,"SOURCE_CHANGED");
 assert.equal(planExactRecovery({...input,workerClaim:{...workerClaim,digest:"0".repeat(64)}}).status,"NO_VALID_CLAIM");
 assert.equal(planExactRecovery({...input,journal:{...journal,state:"CONFIRMED"}}).status,"TERMINAL");
 assert.equal(planExactRecovery({...input,journal:{...journal,state:"BLOCKED"}}).status,"TERMINAL");
 assert.throws(()=>planExactRecovery({...input,journal:{...journal,digest:"0".repeat(64)}}),/JOURNAL_MISMATCH/);
 assert.throws(()=>planExactRecovery({...input,journal:{...journal,state:"OTHER"}}),/INVALID_EXACT_RECOVERY_STATE/);
}
console.log("PASS PHASE17_EXACT_RECOVERY_PLANNER: publish/unpublish, source freshness, CAS metadata, terminal states and unsafe claim refusal");
console.log("OFFLINE_PLANNING_ONLY_NO_REMOTE_WRITE_NO_CROSS_DATABASE_GUARANTEE");
