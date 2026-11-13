"use strict";
// Phase 12.32: emulator-only retention rehearsal; never production.
const assert=require("node:assert/strict");
const admin=require("../functions/node_modules/firebase-admin");
const {sealSnapshot,verifySnapshot}=require("../functions/migrationRecoveryRehearsal");
if(process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080"||
   process.env.GCLOUD_PROJECT!=="demo-boustio-phase1232")
 throw Error("REFUSING: requires isolated Phase 12.32 Firestore emulator");
admin.initializeApp({projectId:"demo-boustio-phase1232"});
const db=admin.firestore();
const backups=db.collection("phase1232-backups").doc("test-owner").collection("versions");
const audit=db.collection("phase1232-audit").doc("test-owner").collection("events");
const base=[{id:"sample-a",time:"09:00"},{id:"sample-b",time:"11:30"}];
const versions=[
 {id:"v001",items:base,sequence:1},
 {id:"v002",items:[...base,{id:"sample-c",time:"12:30"}],sequence:2},
 {id:"v003",items:[...base,{id:"sample-d",time:"14:00"}],sequence:3}
];
async function clear(col){for(const d of (await col.get()).docs)await d.ref.delete();}
async function createBackup(v){
 const sealed=sealSnapshot(JSON.stringify(v.items));
 await backups.doc(v.id).create({...sealed,sequence:v.sequence,createdAt:admin.firestore.FieldValue.serverTimestamp(),state:"sealed"});
 await audit.doc("create-"+v.id).create({type:"backup-created",version:v.id});
}
async function readVersion(id){
 const snap=await backups.doc(id).get();
 if(!snap.exists)throw Error("Backup not found");
 return verifySnapshot(snap.data());
}
async function latestValid(){
 const docs=(await backups.orderBy("sequence","desc").get()).docs;
 for(const doc of docs){
  try{
   if(doc.get("state")!=="sealed")continue;
   return {id:doc.id,items:verifySnapshot(doc.data())};
  }catch(_){}
 }
 throw Error("No valid retained backup");
}
// A test-only delete guard: deliberately no direct delete API is exposed.
async function requestDeletion(id,{approved=false}={}){
 const doc=await backups.doc(id).get();
 if(!doc.exists)throw Error("Backup not found");
 if(!approved)throw Error("Deletion requires independent approval");
 // Approved requests are still only recorded; deletion is not implemented.
 await audit.doc("request-"+id).create({type:"deletion-request",version:id,approved:true});
 return {status:"REVIEW_ONLY",deleted:false};
}
async function run(){
 await clear(backups);await clear(audit);
 for(const v of versions)await createBackup(v);
 assert.equal((await backups.get()).size,3);
 console.log("PASS three retained versioned backups created");
 for(const v of versions)assert.deepEqual(await readVersion(v.id),v.items);
 console.log("PASS every historical backup verifies independently");
 let latest=await latestValid();
 assert.equal(latest.id,"v003");
 assert.deepEqual(latest.items,versions[2].items);
 console.log("PASS newest valid backup selected deterministically");
 await assert.rejects(createBackup(versions[0]),/ALREADY_EXISTS|already exists/i);
 assert.equal((await backups.get()).size,3);
 console.log("PASS existing backup version cannot be overwritten");
 await assert.rejects(requestDeletion("v001"),/independent approval/);
 assert.deepEqual(await readVersion("v001"),base);
 console.log("PASS unapproved deletion refused");
 const requested=await requestDeletion("v001",{approved:true});
 assert.equal(requested.deleted,false);
 assert.equal(requested.status,"REVIEW_ONLY");
 assert.deepEqual(await readVersion("v001"),base);
 console.log("PASS approved request records audit event without deleting backup");
 await backups.doc("v003").update({json:"corrupted"});
 latest=await latestValid();
 assert.equal(latest.id,"v002");
 assert.deepEqual(latest.items,versions[1].items);
 console.log("PASS corrupted newest backup skipped in favour of prior valid version");
 await assert.rejects(readVersion("v003"),/integrity mismatch/);
 assert.deepEqual(await readVersion("v001"),base);
 console.log("PASS corrupted version rejected; older history preserved");
 const events=await audit.get();
 assert.equal(events.size,4);
 console.log("PASS backup and deletion-request audit history retained");
 await clear(backups);await clear(audit);
 assert.equal((await backups.get()).size,0);
 assert.equal((await audit.get()).size,0);
 console.log("PASS isolated test collections cleaned up");
}
run().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
