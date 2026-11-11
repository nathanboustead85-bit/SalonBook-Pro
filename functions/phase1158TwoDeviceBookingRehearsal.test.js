"use strict";
/** Phase 11.58: two independent emulator clients, disposable data only.
 * Not a test involving two physical phones or production Firebase.
 */
const test=require("node:test"),assert=require("node:assert/strict");
const admin=require("firebase-admin");
const projectId="demo-boustio-phase-1158";
if(process.env.GCLOUD_PROJECT!==projectId||process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080")
 throw Error("Phase 11.58 requires the isolated Firestore emulator");
const appA=admin.initializeApp({projectId},"phase1158-phone-a");
const appB=admin.initializeApp({projectId},"phase1158-phone-b");
const dbA=appA.firestore(),dbB=appB.firestore();
const ref=dbA.doc("users/phase1158-disposable/liveData/bookings");
const booking=(id,time)=>({id,client:id,date:"2026-11-11",time,service:"Cut"});
const initial=[booking("demo-a","09:00"),booking("demo-b","11:30")];
const json=JSON.stringify;
const payload=items=>({json:json(items),schemaVersion:1,updatedAt:admin.firestore.FieldValue.serverTimestamp()});
const mapById=items=>{const m=new Map();for(const x of items){if(!x.id||m.has(x.id))throw Error("invalid booking ID");m.set(x.id,x)}return m};
async function read(client){const snap=await client.doc(ref.path).get();if(!snap.exists||snap.get("schemaVersion")!==1||typeof snap.get("json")!=="string")throw Error("unverified server");return snap.get("json")}
async function save(client,proposed,baseline,hook){
 const verified=await read(client),remote=mapById(JSON.parse(verified)),local=mapById(JSON.parse(proposed)),trusted=baseline?mapById(JSON.parse(baseline)):null;
 for(const [id,value] of remote){
  if(!local.has(id))throw Error("cloud-only booking protected");
  if(json(local.get(id))!==json(value)&&(!trusted||json(trusted.get(id))!==json(value)))throw Error("stale edit blocked");
 }
 if(hook)await hook();
 await client.runTransaction(async tx=>{
  const current=await tx.get(client.doc(ref.path));
  if(!current.exists||current.get("schemaVersion")!==1||current.get("json")!==verified)throw Error("concurrent update blocked");
  tx.set(client.doc(ref.path),{json:proposed,schemaVersion:1,updatedAt:admin.firestore.FieldValue.serverTimestamp()});
 });
}
test("11.58 independent clients agree on initial disposable bookings",async()=>{
 await ref.set(payload(initial));
 assert.equal(await read(dbA),await read(dbB));
 assert.equal(JSON.parse(await read(dbB)).length,2);
});
test("11.58 device A edits; device B sees update after a fresh read",async()=>{
 await ref.set(payload(initial));
 const baseline=await read(dbA);
 const edited=[{...initial[0],time:"09:30"},initial[1]];
 await save(dbA,json(edited),baseline);
 assert.deepEqual(JSON.parse(await read(dbB)),edited);
});
test("11.58 stale device B edit is rejected; A's change remains",async()=>{
 await ref.set(payload(initial));
 const baselineA=await read(dbA),baselineB=await read(dbB);
 const fromA=[{...initial[0],time:"09:30"},initial[1]];
 await save(dbA,json(fromA),baselineA);
 await assert.rejects(save(dbB,json([{...initial[0],time:"10:00"},initial[1]]),baselineB),/stale edit blocked/);
 assert.deepEqual(JSON.parse(await read(dbA)),fromA);
});
test("11.58 B adds a cloud-only appointment; stale A cannot delete it",async()=>{
 await ref.set(payload(initial));
 const baselineA=await read(dbA),baselineB=await read(dbB);
 const added=[...initial,booking("new-from-b","15:00")];
 await save(dbB,json(added),baselineB);
 await assert.rejects(save(dbA,json([{...initial[0],time:"09:30"},initial[1]]),baselineA),/cloud-only booking protected/);
 assert.deepEqual(JSON.parse(await read(dbA)),added);
});
test("11.58 edit race between preflight and transaction blocks stale overwrite",async()=>{
 await ref.set(payload(initial));
 const baseline=await read(dbA),newer=[{...initial[0],time:"10:30"},initial[1]];
 await assert.rejects(save(dbA,json([{...initial[0],time:"09:30"},initial[1]]),baseline,()=>dbB.doc(ref.path).set(payload(newer))),/concurrent update blocked/);
 assert.deepEqual(JSON.parse(await read(dbB)),newer);
});
test("11.58 missing verified baseline cannot edit an existing cloud booking",async()=>{
 await ref.set(payload(initial));
 await assert.rejects(save(dbB,json([{...initial[0],time:"09:30"},initial[1]]),null),/stale edit blocked/);
 assert.deepEqual(JSON.parse(await read(dbA)),initial);
});
test("11.58 invalid cloud JSON and schema fail closed",async()=>{
 await ref.set({schemaVersion:1,updatedAt:admin.firestore.FieldValue.serverTimestamp()});
 await assert.rejects(save(dbA,json(initial),json(initial)),/unverified server/);
 await ref.set({...payload(initial),schemaVersion:2});
 await assert.rejects(read(dbB),/unverified server/);
});
test.after(async()=>{try{await ref.delete()}finally{await Promise.all([appA.delete(),appB.delete()])}});
