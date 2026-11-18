"use strict";
const assert=require("node:assert/strict");
const {runExactRecovery}=require("../functions/phase17ExactRecoverySequence");
const {exactPublicationIdentity}=require("../functions/phase17ExactPublicationIdentity");
(async()=>{
 const uid="owner_1",snap=n=>({exists:true,updateTime:{seconds:1763450000,nanoseconds:n}});
 const profile={businessId:uid,name:"Demo Salon",slug:"demo-salon",category:"Hair",phone:"",address:"",description:""};
 for(const operation of ["publish","unpublish"]){
  const identity=exactPublicationIdentity({uid,operation,snapshot:snap(123456001),...(operation==="publish"?{profile}:{})});
  let journal={key:identity.key,digest:identity.digest,revision:identity.revision,uid,operation,state:"PENDING",casRevision:1};
  let writes=0,transitions=0;
  const transitionJournal=async ({expectedRevision,state})=>{
   assert.equal(journal.casRevision,expectedRevision);
   transitions++;journal={...journal,state,casRevision:journal.casRevision+1};return journal;
  };
  const workerClaim={key:identity.key,digest:identity.digest,worker:"worker1",generation:1,state:"HELD"};
  const input={identity,sourceSnapshot:snap(123456001),...(operation==="publish"?{profile}:{}),
   workerClaim,claimPlacement:"destination-transaction",transitionJournal};
  const good=await runExactRecovery({...input,journal,writeDestination:async()=>{writes++;assert.equal(journal.state,"UNKNOWN");return {status:operation==="publish"?"PUBLISHED":"UNPUBLISHED"};}});
  assert.equal(good.status,"CONFIRMED");assert.equal(writes,1);assert.equal(transitions,2);
  assert.equal((await runExactRecovery({...input,journal,writeDestination:async()=>{writes++;}})).status,"TERMINAL");
  assert.equal(writes,1);
  journal={...journal,state:"UNKNOWN",casRevision:4};
  assert.equal((await runExactRecovery({...input,journal,writeDestination:async()=>{throw Error("timeout");}})).status,"UNKNOWN");
  assert.equal(journal.state,"UNKNOWN");
  assert.equal((await runExactRecovery({...input,journal,claimPlacement:"private-database",writeDestination:async()=>{writes++;}})).status,"UNSAFE_CLAIM_PLACEMENT");
  assert.equal((await runExactRecovery({...input,journal,sourceSnapshot:snap(123456002),writeDestination:async()=>{writes++;}})).status,"SOURCE_CHANGED");
  assert.equal(writes,1);
  assert.equal((await runExactRecovery({...input,journal,writeDestination:async()=>({status:"FENCED"})})).status,"UNKNOWN");
  assert.equal(journal.state,"UNKNOWN");
 }
 console.log("PASS PHASE17_EXACT_RECOVERY_SEQUENCE: publish/unpublish, durable UNKNOWN before send, terminal CAS, uncertain results and fail-closed guards");
 console.log("OFFLINE_ONLY_INJECTED_WRITER_NO_CROSS_DATABASE_ATOMICITY_OR_TRUSTED_SOURCE");
})().catch(e=>{console.error(e);process.exitCode=1;});
