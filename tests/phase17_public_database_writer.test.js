"use strict";
const assert=require("node:assert/strict");
const {applyPublicListingCommand}=require("../functions/phase17PublicDatabaseWriter");
class FakeDb{
 constructor(){this.docs=new Map();}
 collection(name){return {doc:id=>({key:name+"/"+id})};}
 async runTransaction(fn){
  const writes=[];
  const tx={
   get:async ref=>{const val=this.docs.get(ref.key);return {exists:val!==undefined,data:()=>val,get:k=>val?.[k]};},
   set:(ref,data)=>writes.push(["set",ref.key,data]),
   delete:ref=>writes.push(["delete",ref.key])
  };
  const result=await fn(tx);
  for(const [op,key,val] of writes){if(op==="set")this.docs.set(key,val);else this.docs.delete(key);}
  return result;
 }
}
const uid="owner_1";
const profile={businessId:uid,name:"Demo Salon",slug:"demo-salon",category:"Hair",phone:"",address:"",description:"",
 privateNotes:"PRIVATE",appointments:[{name:"PRIVATE"}],backups:"PRIVATE"};
const command=(version,operation="publish",p=profile)=>({uid,version,operation,profile:p});
(async()=>{
 const db=new FakeDb();
 assert.deepEqual(await applyPublicListingCommand(db,command(1)),{status:"PUBLISHED",slug:"demo-salon"});
 assert.equal(db.docs.get("publicBusinesses/"+uid).acceptingBookings,false);
 assert.equal(JSON.stringify([...db.docs]).includes("PRIVATE"),false);
 assert.equal((await applyPublicListingCommand(db,command(1))).status,"ALREADY_APPLIED");
 assert.rejects(()=>applyPublicListingCommand(db,command(0)),/INVALID_PUBLICATION_COMMAND/);
 assert.equal((await applyPublicListingCommand(db,command(2,"publish",{...profile,slug:"new-salon"}))).status,"PUBLISHED");
 assert.equal(db.docs.has("businessSlugs/demo-salon"),false);
 assert.equal(db.docs.get("businessSlugs/new-salon").businessId,uid);
 assert.equal((await applyPublicListingCommand(db,command(1))).status,"STALE");
 assert.equal((await applyPublicListingCommand(db,command(3,"unpublish"))).status,"UNPUBLISHED");
 assert.equal(db.docs.get("publicBusinesses/"+uid).published,false);
 assert.equal(db.docs.get("publicBusinesses/"+uid).acceptingBookings,false);
 assert.equal(db.docs.get("publicSlugMappings/new-salon").published,false);
 const other="owner_2";
 const conflict=await applyPublicListingCommand(db,{uid:other,version:1,operation:"publish",profile:{...profile,businessId:other,slug:"new-salon"}});
 assert.equal(conflict.status,"SLUG_TAKEN");
 assert.equal(db.docs.get("businessSlugs/new-salon").businessId,uid);
 assert.equal((await applyPublicListingCommand(db,command(4,"publish",{...profile,slug:"new-salon"}))).status,"PUBLISHED");
 assert.equal(db.docs.get("publicBusinesses/"+uid).acceptingBookings,false);
 console.log("PASS PHASE17_PUBLIC_DATABASE_WRITER: slug ownership, versioning, unpublish, privacy and disabled bookings");
 console.log("OFFLINE_ONLY_NO_DATABASE_CREATION_NO_DEPLOYMENT_NO_FIRESTORE_WRITES");
})().catch(e=>{console.error(e);process.exitCode=1;});
