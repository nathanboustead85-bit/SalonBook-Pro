"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {initializeTestEnvironment,assertFails,assertSucceeds}=require("@firebase/rules-unit-testing");
const {doc,getDoc,setDoc,updateDoc,deleteDoc,runTransaction,writeBatch,Timestamp}=require("firebase/firestore");
const projectId="demo-boustio-phase32-staging",root=path.resolve(__dirname,"..");
const rules=fs.readFileSync(path.join(root,"firestore.rules"),"utf8");
const cfg=JSON.parse(fs.readFileSync(path.join(root,"firebase.phase32-4.json"),"utf8"));
test("Phase 32.6 concurrent client booking attacks are denied by real Firestore rules",async t=>{
 assert.equal(process.env.GCLOUD_PROJECT,projectId);
 assert.equal(process.env.FIRESTORE_EMULATOR_HOST,"127.0.0.1:18080");
 assert.equal(cfg.firestore.rules,"firestore.rules");
 assert.equal(cfg.emulators.firestore.host,"127.0.0.1");
 assert(!JSON.stringify(cfg).includes("salonbook-pro-ad5ff"));
 const env=await initializeTestEnvironment({projectId,firestore:{host:"127.0.0.1",port:18080,rules}});
 t.after(async()=>{await env.cleanup()});
 const owner="phase326owner",other="phase326other";
 const clients=[
  ["verified owner",env.authenticatedContext(owner,{email_verified:true}).firestore()],
  ["unverified owner",env.authenticatedContext(owner,{email_verified:false}).firestore()],
  ["other verified owner",env.authenticatedContext(other,{email_verified:true}).firestore()],
  ["anonymous customer",env.unauthenticatedContext().firestore()]
 ];
 const paths=[
  "users/"+owner+"/customerBookingReservations/reservation",
  "users/"+owner+"/customerBookingRequests/request",
  "businesses/"+owner+"/customerBookingGuards/guard",
  "businesses/"+owner+"/bookingLocks/lock",
  "businesses/"+owner+"/appointments/appointment",
  "businesses/"+owner+"/migrations/android-bookings-v1",
  "businesses/"+owner+"/settings/bookingMode"
 ];
 await env.withSecurityRulesDisabled(async ctx=>{
  const admin=ctx.firestore();
  for(const p of paths)await setDoc(doc(admin,p),{synthetic:true,mode:"frozen"});
 });
 const attacks=[];
 for(const [label,db] of clients){
  for(const p of paths){
   attacks.push({name:label+" cannot create "+p,run:()=>setDoc(doc(db,p+"-new"),{synthetic:true,mode:"legacy"})});
   attacks.push({name:label+" cannot update "+p,run:()=>updateDoc(doc(db,p),{synthetic:false,mode:"legacy"})});
   attacks.push({name:label+" cannot delete "+p,run:()=>deleteDoc(doc(db,p))});
  }
 }
 await t.test("concurrent direct client creates, updates and deletes all denied",async sub=>{
  await Promise.all(attacks.map(a=>sub.test(a.name,async()=>{await assertFails(a.run())})));
 });
 await t.test("concurrent reservation and lock read attempts all denied",async sub=>{
  const protectedPaths=paths.slice(0,4).concat(paths[5]);
  await Promise.all(clients.flatMap(([label,db])=>protectedPaths.map(p=>sub.test(label+" cannot read "+p,async()=>{await assertFails(getDoc(doc(db,p)))}))));
 });
 const verified=clients[0][1];
 await t.test("atomic batch cannot create appointment and lock",async()=>{
  const batch=writeBatch(verified);
  batch.set(doc(verified,"businesses/"+owner+"/appointments/batch-new"),{synthetic:true});
  batch.set(doc(verified,"businesses/"+owner+"/bookingLocks/batch-new"),{synthetic:true});
  await assertFails(batch.commit());
 });
 await t.test("client transaction cannot mutate existing appointment",async()=>{
  await assertFails(runTransaction(verified,async tx=>{
   const ref=doc(verified,"businesses/"+owner+"/appointments/appointment");
   await tx.get(ref);
   tx.update(ref,{synthetic:false});
  },{maxAttempts:1}));
 });
 await t.test("client cannot bypass booking guard with bookingMode update",async()=>{
  await assertFails(updateDoc(doc(verified,"businesses/"+owner+"/settings/bookingMode"),{mode:"legacy"}));
 });
 await t.test("verified owner still reads permitted appointment",async()=>{
  await assertSucceeds(getDoc(doc(verified,"businesses/"+owner+"/appointments/appointment")));
 });
 await t.test("denied attacks left seeded server-only records unchanged",async()=>{
  await env.withSecurityRulesDisabled(async ctx=>{
   const admin=ctx.firestore();
   for(const p of paths){
    const snapshot=await getDoc(doc(admin,p));
    assert.equal(snapshot.exists(),true,p);
    assert.equal(snapshot.data().synthetic,true,p);
   }
   assert.equal((await getDoc(doc(admin,"businesses/"+owner+"/appointments/batch-new"))).exists(),false);
   assert.equal((await getDoc(doc(admin,"businesses/"+owner+"/bookingLocks/batch-new"))).exists(),false);
  });
 });
});
