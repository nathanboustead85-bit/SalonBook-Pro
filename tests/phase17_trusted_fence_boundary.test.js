"use strict";
const assert=require("node:assert/strict");
const {acceptTrustedPublication,EXPECTED_CALLER}=require("../functions/phase17ServiceIdentityBoundary");
class Db{
 constructor(){this.docs=new Map();this.queue=Promise.resolve();}
 collection(c){return {doc:id=>({key:c+"/"+id})};}
 snap(k){const v=this.docs.get(k);return {exists:v!==undefined,data:()=>structuredClone(v),get:f=>v?.[f]};}
 runTransaction(fn){const job=this.queue.then(async()=>{const writes=[];const tx={get:async r=>this.snap(r.key),set:(r,v)=>writes.push(["set",r.key,structuredClone(v)]),delete:r=>writes.push(["delete",r.key])};const result=await fn(tx);for(const [op,k,v] of writes){if(op==="delete")this.docs.delete(k);else this.docs.set(k,v);}return result;});this.queue=job.catch(()=>{});return job;}
}
(async()=>{
 const db=new Db(),uid="owner_1",audience="https://writer.example.com";
 const command={uid,operation:"publish",version:1,profile:{businessId:uid,name:"Demo Salon",slug:"demo-salon",category:"Hair",phone:"",address:"",description:"",acceptingBookings:false}};
 const fence={key:uid+":publish:1",worker:"worker_a",generation:1};
 const verifyIdToken=async()=>({iss:"https://accounts.google.com",aud:audience,email:EXPECTED_CALLER,email_verified:true,sub:"123456789",exp:Math.floor(Date.now()/1000)+3600});
 const base={authorization:"Bearer test.token",audience,verifyIdToken,publicDb:db,command,requireFence:true};
 await assert.rejects(()=>acceptTrustedPublication({...base,fence}),/TRUSTED_FENCE_VERIFIER_REQUIRED/);
 await assert.rejects(()=>acceptTrustedPublication({...base,fence,verifyRecoveryFence:async()=>false}),/RECOVERY_FENCE_NOT_AUTHORISED/);
 await assert.rejects(()=>acceptTrustedPublication({...base,fence:{...fence,key:"other"},verifyRecoveryFence:async()=>true}),/INVALID_RECOVERY_FENCE/);
 assert.equal(db.docs.size,0);
 assert.equal((await acceptTrustedPublication({...base,fence,verifyRecoveryFence:async()=>true})).status,"PUBLISHED");
 assert.equal((await acceptTrustedPublication({...base,fence:{...fence,generation:2,worker:"worker_b"},verifyRecoveryFence:async()=>true})).status,"ALREADY_APPLIED");
 assert.equal((await acceptTrustedPublication({...base,fence,verifyRecoveryFence:async()=>true})).status,"FENCED");
 assert.equal(db.docs.get("publicBusinesses/"+uid).acceptingBookings,false);
 console.log("PASS PHASE17_TRUSTED_FENCE_BOUNDARY: absent, denied and malformed claims fail closed; destination rejects stale generation");
 console.log("OFFLINE_ONLY_FAKE_IDENTITY_AND_DATABASE_NO_DEPLOYMENT");
})().catch(e=>{console.error(e);process.exitCode=1;});
