"use strict";
// Phase 11.38: real Firestore emulator I/O with two independent clients.
// Never points at production; both clients use a disposable demo project.
const test=require("node:test");
const assert=require("node:assert/strict");
const admin=require("firebase-admin");
const projectId="demo-boustio-phase-1138";
if(process.env.GCLOUD_PROJECT!==projectId || process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080"){
  throw new Error("Refusing to run outside isolated Phase 11.38 Firestore emulator");
}
const appA=admin.initializeApp({projectId},"device-a");
const appB=admin.initializeApp({projectId},"device-b");
const dbA=appA.firestore(),dbB=appB.firestore();
const doc=dbA.doc("users/phase1138-isolated-owner/liveData/bookings");
const first={id:"device-a-booking",client:"First",date:"2026-11-11",time:"09:00",duration:30,staffId:"staff-a"};
const second={id:"device-b-booking",client:"Second",date:"2026-11-11",time:"10:00",duration:30,staffId:"staff-a"};
const payload=(items)=>({json:JSON.stringify(items),schemaVersion:1,updatedAt:admin.firestore.FieldValue.serverTimestamp()});
test("11.38 emulator: two independent clients see cloud-only booking and preserve first",async()=>{
  try{
    await doc.set(payload([first]));
    const localA=JSON.parse((await doc.get()).get("json"));
    assert.deepEqual(localA,[first]);
    const bRef=dbB.doc(doc.path);
    await dbB.runTransaction(async tx=>{
      const snapshot=await tx.get(bRef);
      const items=JSON.parse(snapshot.get("json"));
      assert.deepEqual(items,[first]);
      tx.update(bRef,payload([...items,second]));
    });
    const cloudA=JSON.parse((await doc.get()).get("json"));
    assert.deepEqual(cloudA,[first,second]);
    const only=cloudA.filter(x=>!localA.some(y=>y.id===x.id));
    assert.deepEqual(only,[second]);
    const imported=[...localA,...only];
    assert.deepEqual(imported,[first,second]);
    assert.deepEqual([...imported,...cloudA.filter(x=>!imported.some(y=>y.id===x.id))],imported);
  }finally{await doc.delete();}
});
test.after(async()=>{await Promise.all([appA.delete(),appB.delete()]);});
