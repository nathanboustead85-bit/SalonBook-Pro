"use strict";
const assert=require("node:assert/strict");
const {publishVerifiedOwner}=require("../functions/phase17TrustedPublicationBridge");
class Db {
 constructor(){this.data=new Map();}
 collection(c){return {doc:id=>({key:c+"/"+id})};}
 async runTransaction(fn){
  const writes=[];
  const tx={
   get:async r=>{const d=this.data.get(r.key);return {exists:d!==undefined,data:()=>d,get:k=>d?.[k]};},
   set:(r,d)=>writes.push(["set",r.key,d]),
   delete:r=>writes.push(["delete",r.key])
  };
  const result=await fn(tx);
  for(const [op,key,data] of writes){if(op==="set")this.data.set(key,data);else this.data.delete(key);}
  return result;
 }
}
const uid="owner_1";
const profile={businessId:uid,name:"Demo Salon",slug:"demo-salon",category:"Hair",phone:"",address:"",description:"",
 privateNotes:"SECRET",bookings:[{customer:"SECRET"}],backups:{data:"SECRET"}};
(async()=>{
 const db=new Db();
 let reads=0;
 const loadPrivateProfile=async id=>{reads++;assert.equal(id,uid);return profile;};
 const base={publicDb:db,loadPrivateProfile,version:1};
 assert.deepEqual(await publishVerifiedOwner({...base,auth:null}),{status:"UNAUTHENTICATED"});
 assert.deepEqual(await publishVerifiedOwner({...base,auth:{uid,emailVerified:false}}),{status:"UNAUTHENTICATED"});
 assert.equal(reads,0);
 assert.deepEqual(await publishVerifiedOwner({...base,auth:{uid,emailVerified:true}}),{status:"PUBLISHED",slug:"demo-salon"});
 assert.equal(reads,1);
 assert.equal(JSON.stringify([...db.data]).includes("SECRET"),false);
 assert.equal(db.data.get("publicBusinesses/"+uid).acceptingBookings,false);
 assert.equal((await publishVerifiedOwner({...base,auth:{uid,emailVerified:true}})).status,"ALREADY_APPLIED");
 const mismatch=await publishVerifiedOwner({...base,auth:{uid,emailVerified:true},version:2,loadPrivateProfile:async()=>({...profile,businessId:"another"})});
 assert.equal(mismatch.status,"OWNER_PROFILE_NOT_FOUND");
 assert.equal(db.data.get("publicBusinesses/"+uid).publicationVersion,1);
 const missing=await publishVerifiedOwner({...base,auth:{uid,emailVerified:true},version:2,loadPrivateProfile:async()=>null});
 assert.equal(missing.status,"OWNER_PROFILE_NOT_FOUND");
 const invalid=await publishVerifiedOwner({...base,auth:{uid,emailVerified:true},version:2,loadPrivateProfile:async()=>({...profile,slug:"../unsafe"})});
 assert.equal(invalid.status,"INVALID_OWNER_PROFILE");
 await assert.rejects(()=>publishVerifiedOwner({...base,auth:{uid,emailVerified:true},version:2,loadPrivateProfile:async()=>{throw Error("PRIVATE_READ_FAILED");}}),/PRIVATE_READ_FAILED/);
 assert.equal(db.data.get("publicBusinesses/"+uid).publicationVersion,1);
 await assert.rejects(()=>publishVerifiedOwner({...base,auth:{uid,emailVerified:true},version:2,publicDb:{runTransaction:async()=>{throw Error("PUBLIC_WRITE_FAILED");}}}),/PUBLIC_WRITE_FAILED/);
 assert.equal(db.data.get("publicBusinesses/"+uid).publicationVersion,1);
 console.log("PASS PHASE17_TRUSTED_PUBLICATION_BRIDGE: auth, ownership, data minimisation, idempotency and failure propagation");
 console.log("OFFLINE_ONLY_NO_DATABASE_CREATION_NO_DEPLOYMENT_NO_FIRESTORE_WRITES");
})().catch(error=>{console.error(error);process.exitCode=1;});
