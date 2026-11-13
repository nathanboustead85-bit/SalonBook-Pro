"use strict";
// Phase 12.31: isolated Firestore emulator backup/restore drill.
// NEVER run against production, even with a demo-looking project ID.
const assert=require("node:assert/strict");
const admin=require("../functions/node_modules/firebase-admin");
const {sealSnapshot,verifySnapshot}=require("../functions/migrationRecoveryRehearsal");
if(process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080" ||
   process.env.GCLOUD_PROJECT!=="demo-boustio-phase1231")
 throw Error("REFUSING: Phase 12.31 requires isolated emulator and demo project");
admin.initializeApp({projectId:"demo-boustio-phase1231"});
const db=admin.firestore();
const source=db.collection("phase1231-source").doc("sample");
const backup=db.collection("phase1231-backups").doc("sealed-v1");
const target=db.collection("phase1231-restore").doc("separate-test-business");
const items=[
 {id:"sample-09",staffId:"test-staff",date:"2026-11-20",time:"09:00",duration:30},
 {id:"sample-1130",staffId:"test-staff",date:"2026-11-20",time:"11:30",duration:30}
];
async function clear(ref){
 const snap=await ref.collection("appointments").get();
 for(const doc of snap.docs)await doc.ref.delete();
}
async function list(ref){
 const snap=await ref.collection("appointments").get();
 return snap.docs.map(d=>d.data()).sort((a,b)=>a.id.localeCompare(b.id));
}
async function restore(envelope){
 const verified=verifySnapshot(envelope);
 if(verified.length>100)throw Error("Backup too large for test transaction");
 const ids=verified.map(x=>x?.id);
 if(ids.some(x=>typeof x!=="string"||!/^[a-zA-Z0-9-]{1,80}$/.test(x))||
    new Set(ids).size!==ids.length)throw Error("Invalid or duplicate backup IDs");
 const refs=ids.map(id=>target.collection("appointments").doc(id));
 await db.runTransaction(async tx=>{
  const existing=await Promise.all(refs.map(ref=>tx.get(ref)));
  if(existing.some(s=>s.exists))throw Error("Restore destination already contains appointments");
  verified.forEach((item,i)=>tx.create(refs[i],item));
 });
}
async function run(){
 await clear(source);await clear(target);await backup.delete();
 for(const item of items)await source.collection("appointments").doc(item.id).set(item);
 assert.deepEqual(await list(source),items);
 console.log("PASS isolated source appointments created");
 const sealed=sealSnapshot(JSON.stringify(await list(source)));
 await backup.create({...sealed,source:"emulator-only"});
 const stored=(await backup.get()).data();
 assert.deepEqual(verifySnapshot(stored),items);
 console.log("PASS persisted emulator backup checksum verified");
 await restore(stored);
 assert.deepEqual(await list(target),items);
 assert.deepEqual(await list(source),items);
 console.log("PASS separate destination restore matches source exactly");
 await assert.rejects(restore(stored),/Restore destination already contains appointments/);
 assert.deepEqual(await list(target),items);
 console.log("PASS repeated restore refuses overwrite and duplicates");
 await clear(target);
 await assert.rejects(restore({...stored,json:stored.json+" "}),/integrity mismatch/);
 assert.deepEqual(await list(target),[]);
 console.log("PASS corrupted backup blocked before any restore writes");
 await assert.rejects(restore(null),/Invalid backup envelope/);
 assert.deepEqual(await list(target),[]);
 console.log("PASS missing backup blocked before any restore writes");
 const duplicate=sealSnapshot(JSON.stringify([items[0],items[0]]));
 await assert.rejects(restore(duplicate),/Invalid or duplicate backup IDs/);
 assert.deepEqual(await list(target),[]);
 console.log("PASS duplicate IDs rejected before any restore writes");
 await target.collection("appointments").doc(items[1].id).set({id:items[1].id,existing:true});
 await assert.rejects(restore(stored),/Restore destination already contains appointments/);
 assert.equal((await target.collection("appointments").doc(items[1].id).get()).get("existing"),true);
 assert.equal((await target.collection("appointments").get()).size,1);
 console.log("PASS existing destination record preserved without partial restore");
 assert.deepEqual(await list(source),items);
 assert.deepEqual(verifySnapshot((await backup.get()).data()),items);
 console.log("PASS original source and sealed backup remain intact");
 await clear(source);await clear(target);await backup.delete();
 assert.deepEqual(await list(source),[]);
 assert.deepEqual(await list(target),[]);
 assert.equal((await backup.get()).exists,false);
 console.log("PASS disposable emulator test data cleaned up");
}
run().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
