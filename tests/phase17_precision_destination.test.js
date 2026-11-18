"use strict";
const assert=require("node:assert/strict");
const {applyPublicListingCommand}=require("../functions/phase17PublicDatabaseWriter");
class Db{
 constructor(){this.docs=new Map();this.queue=Promise.resolve();}
 collection(c){return {doc:id=>({key:c+"/"+id})};}
 runTransaction(fn){const run=this.queue.then(async()=>{const writes=[];const tx={get:async r=>{const v=this.docs.get(r.key);return {exists:v!==undefined,data:()=>structuredClone(v),get:k=>v?.[k]};},set:(r,v)=>writes.push(["set",r.key,structuredClone(v)]),delete:r=>writes.push(["delete",r.key])};const result=await fn(tx);for(const [op,k,v] of writes)op==="set"?this.docs.set(k,v):this.docs.delete(k);return result;});this.queue=run.catch(()=>{});return run;}
}
(async()=>{
 const db=new Db(),uid="owner_1",profile={businessId:uid,name:"Demo Salon",slug:"demo-salon",category:"Hair",phone:"",address:"",description:""};
 const base=1763450000*1000000;
 const cmd={uid,operation:"publish",version:base+123456,fullPrecisionRevision:"0000001763450000:123456000",profile};
 assert.equal((await applyPublicListingCommand(db,cmd)).status,"PUBLISHED");
 assert.equal(db.docs.get("publicBusinesses/"+uid).fullPrecisionRevision,cmd.fullPrecisionRevision);
 for(const bad of ["0000001763450000:123456001","0000001763450000:123457000","invalid"]){
  await assert.rejects(()=>applyPublicListingCommand(db,{...cmd,version:base+123457,fullPrecisionRevision:bad}),/PRECISION_VERSION_MISMATCH|INVALID_FULL_PRECISION_REVISION/);
 }
 assert.equal(db.docs.get("publicBusinesses/"+uid).publicationVersion,cmd.version);
 const next={...cmd,version:base+123457,fullPrecisionRevision:"0000001763450000:123457000"};
 assert.equal((await applyPublicListingCommand(db,next)).status,"PUBLISHED");
 assert.equal((await applyPublicListingCommand(db,cmd)).status,"STALE");
 const legacy={uid,operation:"unpublish",version:base+123458};
 assert.equal((await applyPublicListingCommand(db,legacy)).status,"UNPUBLISHED");
 assert.equal(db.docs.get("publicBusinesses/"+uid).fullPrecisionRevision,undefined);
 assert.equal(db.docs.get("publicBusinesses/"+uid).acceptingBookings,false);
 console.log("PASS PHASE17_PRECISION_DESTINATION: exact token validation, monotonic numeric compatibility, stale rejection, legacy token cleanup");
 console.log("OFFLINE_ONLY_NO_LIVE_FIRESTORE_NO_DEPLOYMENT_NO_REVISION_MIGRATION");
})().catch(e=>{console.error(e);process.exitCode=1;});
