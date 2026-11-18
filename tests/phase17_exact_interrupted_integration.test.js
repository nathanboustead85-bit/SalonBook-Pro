"use strict";
const assert=require("node:assert/strict");
const {runExactRecovery}=require("../functions/phase17ExactRecoverySequence");
const {applyExactPublish}=require("../functions/phase17ExactPublicWriter");
const {exactPublicationIdentity}=require("../functions/phase17ExactPublicationIdentity");
class Db{
 constructor(){this.docs=new Map();this.queue=Promise.resolve();}
 collection(c){return {doc:id=>({key:c+"/"+id})};}
 runTransaction(fn){const job=this.queue.then(async()=>{const writes=[],tx={get:async r=>{const v=this.docs.get(r.key);return {exists:v!==undefined,data:()=>structuredClone(v),get:k=>v?.[k]};},set:(r,v)=>writes.push(["set",r.key,structuredClone(v)]),delete:r=>writes.push(["delete",r.key])};const result=await fn(tx);for(const [op,k,v]of writes)op==="set"?this.docs.set(k,v):this.docs.delete(k);return result;});this.queue=job.catch(()=>{});return job;}
}
(async()=>{
 const db=new Db(),uid="owner_1",snapshot={exists:true,updateTime:{seconds:1763450000,nanoseconds:123456001}};
 const profile={businessId:uid,name:"Demo Salon",slug:"demo-salon",category:"Hair",phone:"",address:"",description:""};
 const identity=exactPublicationIdentity({uid,operation:"publish",snapshot,profile});
 let journal={key:identity.key,digest:identity.digest,revision:identity.revision,uid,operation:"publish",state:"PENDING",casRevision:1};
 let now=1000,writeCalls=0;
 const claimKey="publicationExactRecoveryClaims/"+identity.key;
 const claim=(worker,generation,expiresAt)=>db.docs.set(claimKey,{key:identity.key,digest:identity.digest,worker,generation,state:"HELD",expiresAt});
 claim("worker1",1,2000);
 const transitionJournal=async ({expectedRevision,state})=>{
  assert.equal(expectedRevision,journal.casRevision);
  journal={...journal,state,casRevision:journal.casRevision+1};
  return journal;
 };
 const workerClaim=()=>db.docs.get(claimKey);
 const writeDestination=async args=>{
  writeCalls++;
  return applyExactPublish({db,identity:args.identity,profile:args.profile,sourceSnapshot:args.sourceSnapshot,nowMs:()=>now,claimPlacement:args.claimPlacement});
 };
 const run=(extra={})=>runExactRecovery({identity,journal,sourceSnapshot:snapshot,profile,
  workerClaim:workerClaim(),claimPlacement:"destination-transaction",writeDestination,transitionJournal,...extra});
 // Worker 1's write commits, but the response is lost: journal remains UNKNOWN.
 const lost=await run({writeDestination:async args=>{const result=await writeDestination(args);assert.equal(result.status,"PUBLISHED");throw Error("response lost");}});
 assert.equal(lost.status,"UNKNOWN");
 assert.equal(journal.state,"UNKNOWN");
 assert.equal(db.docs.get("publicBusinesses/"+uid).fullPrecisionRevision,identity.revision);
 // A stale worker cannot publish after its claim expires and another takes over.
 now=2001;claim("worker2",2,5000);
 const oldClaim={...workerClaim(),worker:"worker1",generation:1};
 assert.equal((await run({workerClaim:oldClaim})).status,"READY_FOR_DESTINATION_RECHECK");
 // Planner is advisory: destination must still reject if its authoritative claim is expired.
 now=5001;
 assert.equal((await run()).status,"UNKNOWN");
 assert.equal(journal.state,"UNKNOWN");
 // New valid destination claim enables idempotent recovery and CAS confirmation.
 now=3000;claim("worker2",3,6000);
 const recovered=await run();
 assert.equal(recovered.status,"CONFIRMED");
 assert.equal(recovered.destinationStatus,"ALREADY_APPLIED");
 assert.equal(journal.state,"CONFIRMED");
 assert.equal((await run()).status,"TERMINAL");
 assert.equal(db.docs.get("publicBusinesses/"+uid).fullPrecisionRevision,identity.revision);
 assert.equal(writeCalls,3);
 console.log("PASS PHASE17_EXACT_INTERRUPTED_INTEGRATION: lost response, expired destination claim, idempotent recovery, terminal journal");
 console.log("OFFLINE_MOCK_ONLY_NOT_CROSS_DATABASE_ATOMICITY_NOT_PRODUCTION_AUTH");
})().catch(e=>{console.error(e);process.exitCode=1;});
