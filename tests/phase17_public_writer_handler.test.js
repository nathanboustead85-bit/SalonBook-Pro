"use strict";
const assert=require("node:assert/strict");
const {createPublicWriterHandler}=require("../functions/phase17PublicWriterHandler");
const {EXPECTED_CALLER}=require("../functions/phase17ServiceIdentityBoundary");
class FakeDb{
 constructor(){this.docs=new Map();}
 collection(c){return {doc:id=>({key:c+"/"+id})};}
 async runTransaction(fn){
  const writes=[];const tx={get:async ref=>{const v=this.docs.get(ref.key);return {exists:v!==undefined,data:()=>v,get:k=>v?.[k]};},
   set:(ref,v)=>writes.push(["set",ref.key,v]),delete:ref=>writes.push(["delete",ref.key])};
  const result=await fn(tx);
  for(const [op,k,v] of writes){if(op==="set")this.docs.set(k,v);else this.docs.delete(k);}
  return result;
 }
}
(async()=>{
 const audience="https://boustio-public-writer-example.a.run.app",db=new FakeDb(),app={};
 let tokenCalls=0,dbCalls=0;
 const tokenClaims={iss:"https://accounts.google.com",aud:audience,email:EXPECTED_CALLER,email_verified:true,sub:"123456789",exp:Math.floor(Date.now()/1000)+3600};
 const client={verifyIdToken:async ({idToken,audience:requested})=>{tokenCalls++;assert.equal(idToken,"signed.header.payload");assert.equal(requested,audience);return {getPayload:()=>tokenClaims};}};
 const config={databaseId:"boustio-public",runtimeRole:"public-writer",privateDatabaseAccess:false,customerBookingsEnabled:false};
 const fence={key:"owner_1:publish:1",worker:"worker_1",generation:1};
 const claims={verify:async c=>c.key===fence.key&&c.worker===fence.worker&&c.generation===fence.generation};
 assert.throws(()=>createPublicWriterHandler({app,claims:null}),/TRUSTED_RECOVERY_CLAIMS_REQUIRED/);
 const handler=createPublicWriterHandler({app,claims,getFirestore:(a,id)=>{dbCalls++;assert.equal(a,app);assert.equal(id,"boustio-public");return db;},audience,googleClient:client,config});
 assert.equal(dbCalls,1);
 const command={operation:"publish",uid:"owner_1",version:1,profile:{businessId:"owner_1",name:"Demo Salon",slug:"demo-salon",category:"Hair",phone:"",address:"",description:"",secret:"NEVER_PUBLIC"}};
 const authorization="Bearer signed.header.payload";
 assert.equal((await handler({authorization,command,fence})).status,"PUBLISHED");
 assert.equal((await handler({authorization,command,fence})).status,"ALREADY_APPLIED");
 assert.equal(db.docs.get("publicBusinesses/owner_1").acceptingBookings,false);
 assert.equal(JSON.stringify([...db.docs]).includes("NEVER_PUBLIC"),false);
 const before=JSON.stringify([...db.docs]);
 await assert.rejects(()=>handler({authorization:"Bearer bad.token",command,fence}),/INVALID_SERVICE_TOKEN/);
 await assert.rejects(()=>handler({authorization,command:{...command,uid:"other"},fence}),/INVALID_OWNER_PROFILE/);
 assert.equal(JSON.stringify([...db.docs]),before);
 await assert.rejects(()=>handler({authorization,command}),/INVALID_RECOVERY_FENCE/);
 await assert.rejects(()=>handler({authorization,command,fence:{...fence,worker:"intruder"}}),/RECOVERY_FENCE_NOT_AUTHORISED/);
 assert.equal(tokenCalls,5);
 assert.throws(()=>createPublicWriterHandler({app,claims,getFirestore:()=>db,audience,googleClient:client,config:{...config,privateDatabaseAccess:true}}),/PUBLIC_WRITER_CONFIG_NOT_APPROVED/);
 console.log("PASS PHASE17_PUBLIC_WRITER_HANDLER: authenticated fenced offline publication, retries, private-field exclusion, fail-closed config");
 console.log("NO_DEPLOYMENT_NO_IAM_NO_LIVE_FIRESTORE_WRITES_REAL_REVISION_SOURCE_PENDING");
})().catch(e=>{console.error(e);process.exitCode=1;});
