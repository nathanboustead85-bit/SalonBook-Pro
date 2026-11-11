"use strict";
/** Phase 11.43: isolated real Firestore emulator reconnect scenarios.
 * Offline phone is modelled as a local snapshot with no network writes.
 * This does NOT simulate Android OS network loss or Firebase client queues.
 */
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const admin=require("firebase-admin");
const projectId="demo-boustio-phase-1143";
if(process.env.GCLOUD_PROJECT!==projectId || process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080")
 throw Error("Refusing Phase 11.43 outside isolated emulator");
const appA=admin.initializeApp({projectId},"phase1143-phone");
const appB=admin.initializeApp({projectId},"phase1143-second-device");
const db=appA.firestore(),other=appB.firestore();
const ref=db.doc("users/phase1143-isolated-fixture/liveData/bookings");
const booking=(id,time)=>({id,client:id,service:"Cut",date:"2026-11-11",time,notes:"",serviceId:"cut",staffId:"staff",duration:30,price:"20"});
const first=booking("first","09:00"),second=booking("second","10:00"),offline=booking("offline","11:00");
const payload=items=>({json:JSON.stringify(items),schemaVersion:1,updatedAt:admin.firestore.FieldValue.serverTimestamp()});
const parse=s=>JSON.parse(s.get("json"));
async function conservativeUpload(local,expectedServerJson){
 const preflight=await ref.get();
 if(!preflight.exists||preflight.get("schemaVersion")!==1)throw Error("unverified server");
 if(preflight.get("json")!==expectedServerJson)throw Error("stale server snapshot");
 const localIds=new Set(local.map(x=>x.id));
 if(localIds.size!==local.length||parse(preflight).some(x=>!localIds.has(x.id)))
  throw Error("cloud booking missing locally");
 return db.runTransaction(async tx=>{
  const latest=await tx.get(ref);
  if(latest.get("json")!==preflight.get("json"))throw Error("concurrent cloud edit");
  tx.set(ref,payload(local));
 });
}
test("11.43 offline local edit stays on phone and cannot overwrite another device on reconnect",async()=>{
 await ref.set(payload([first]));
 const initial=await ref.get();
 const phoneLocal=[first,offline]; // offline: local-only, no Firestore call
 assert.deepEqual(parse(await ref.get()),[first],"offline edit not silently sent");
 await other.doc(ref.path).set(payload([first,second]));
 await assert.rejects(conservativeUpload(phoneLocal,initial.get("json")),/stale server snapshot/);
 assert.deepEqual(parse(await ref.get()),[first,second],"second device booking retained");
 assert.deepEqual(phoneLocal,[first,offline],"phone edit remains available for review");
});
test("11.43 unchanged cloud can accept a verified reconnect upload",async()=>{
 await ref.set(payload([first]));
 const initial=await ref.get();
 await conservativeUpload([first,offline],initial.get("json"));
 assert.deepEqual(parse(await ref.get()),[first,offline]);
});
test("11.43 remote deletion or edit prevents stale reconnect upload",async()=>{
 await ref.set(payload([first]));
 const initial=await ref.get();
 await other.doc(ref.path).set(payload([]));
 await assert.rejects(conservativeUpload([first,offline],initial.get("json")),/stale server snapshot/);
 assert.deepEqual(parse(await ref.get()),[]);
 await ref.set(payload([{...first,time:"09:30"}]));
 await assert.rejects(conservativeUpload([first,offline],initial.get("json")),/stale server snapshot/);
 assert.deepEqual(parse(await ref.get()),[{...first,time:"09:30"}]);
});
test("11.43 Android guards pending status, server read and no automatic reconnect replay",()=>{
 const main=fs.readFileSync(path.join(__dirname,"../app/src/main/java/com/salonbook/pro/MainActivity.kt"),"utf8");
 const sync=fs.readFileSync(path.join(__dirname,"../app/src/main/java/com/salonbook/pro/CloudSyncManager.kt"),"utf8");
 assert.match(main,/bookingSyncPendingOwner/);
 assert.match(main,/bookingSyncPendingJson/);
 assert.match(main,/Nothing will be uploaded automatically on reconnect/);
 assert.match(sync,/reference\.get\(Source\.SERVER\)/);
 assert.match(sync,/db\.runTransaction/);
 assert.match(sync,/assertNoRemoteBookingsLost\(latest\.getString\("json"\), json\)/);
});
test.after(async()=>{try{await ref.delete();}finally{await Promise.all([appA.delete(),appB.delete()]);}});
