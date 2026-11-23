const {before,after,test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
let env;
const root=path.resolve(__dirname,'../..');
const uid='phase574-owner-a', other='phase574-owner-b';
const hash='a'.repeat(64);
const auth=(id,verified)=>env.authenticatedContext(id,{email_verified:verified}).firestore();
const anon=()=>env.unauthenticatedContext().firestore();
before(async()=>{
 assert.ok(process.env.FIRESTORE_EMULATOR_HOST,'Firebase emulator required; never connect to live Firebase');
 assert.ok(process.env.GCLOUD_PROJECT?.startsWith('demo-'),'Only demo projects permitted');
 env=await initializeTestEnvironment({projectId:process.env.GCLOUD_PROJECT,firestore:{rules:fs.readFileSync(path.join(root,'firestore.rules'),'utf8')}});
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await db.doc('publicBusinesses/published').set({published:true,name:'Test'});
  await db.doc('publicBusinesses/draft').set({published:false,name:'Draft'});
  await db.doc('businesses/'+uid+'/appointments/existing').set({status:'test'});
  await db.doc('businesses/'+uid+'/settings/bookingMode').set({mode:'legacy'});
  await db.doc('businesses/'+uid+'/conversations/c1').set({status:'test'});
 });
});
after(async()=>{if(env)await env.cleanup()});
test('anonymous denied private data, unknown paths and writes',async()=>{
 await assertFails(anon().doc('users/'+uid+'/backups/latest').get());
 await assertFails(anon().doc('businesses/'+uid+'/appointments/existing').get());
 await assertFails(anon().doc('unrecognised/path').set({x:1}));
});
test('cross-business reads and writes denied',async()=>{
 await assertFails(auth(other,true).doc('businesses/'+uid+'/appointments/existing').get());
 await assertFails(auth(other,true).doc('users/'+uid+'/backups/latest').set({x:1}));
 await assertFails(auth(other,true).doc('users/'+uid+'/liveData/services').set({json:'{}',schemaVersion:1,updatedAt:new Date()}));
});
test('verified owner can read appointment but cannot write appointments or chat',async()=>{
 const db=auth(uid,true);
 await assertSucceeds(db.doc('businesses/'+uid+'/appointments/existing').get());
 await assertFails(db.doc('businesses/'+uid+'/appointments/new').set({status:'test'}));
 await assertFails(db.doc('businesses/'+uid+'/appointments/existing').delete());
 await assertFails(db.doc('businesses/'+uid+'/conversations/c1').set({x:1}));
 await assertFails(db.doc('businesses/'+uid+'/conversations/c1/messages/m1').set({text:'hello'}));
 await assertFails(db.doc('businesses/'+uid+'/bookingLocks/l1').get());
});
test('unverified owner cannot read appointments or write liveData',async()=>{
 await assertFails(auth(uid,false).doc('businesses/'+uid+'/appointments/existing').get());
 await assertFails(auth(uid,false).doc('users/'+uid+'/liveData/services').set({json:'{}',schemaVersion:1,updatedAt:new Date()}));
});
test('legacy bookings allowed only before migration and in legacy mode',async()=>{
 const db=auth(uid,true);
 const doc=db.doc('users/'+uid+'/liveData/bookings');
 const payload={json:'{}',schemaVersion:1,updatedAt:new Date()};
 await assertSucceeds(doc.set(payload));
 await env.withSecurityRulesDisabled(async ctx=>ctx.firestore().doc('businesses/'+uid+'/settings/bookingMode').set({mode:'backend'}));
 await assertFails(doc.set(payload));
 await env.withSecurityRulesDisabled(async ctx=>ctx.firestore().doc('businesses/'+uid+'/settings/bookingMode').set({mode:'legacy'}));
 await env.withSecurityRulesDisabled(async ctx=>ctx.firestore().doc('businesses/'+uid+'/migrations/android-bookings-v1').set({done:true}));
 await assertFails(doc.set(payload));
});
test('published directory get only; listing and draft get denied',async()=>{
 await assertSucceeds(anon().doc('publicBusinesses/published').get());
 await assertFails(anon().doc('publicBusinesses/draft').get());
 await assertFails(anon().collection('publicBusinesses').get());
 await assertFails(auth(uid,true).doc('publicBusinesses/published').set({published:true}));
});
test('client profile validation and listing restrictions',async()=>{
 const db=auth(uid,true);
 await assertFails(db.collection('users/'+uid+'/clientProfiles').get());
 await assertFails(db.doc('users/'+uid+'/clientProfiles/not-a-hash').set({name:'Example'}));
 await assertFails(db.doc('users/'+uid+'/clientProfiles/'+hash).set({name:'Example',phone:'',email:'',notes:'',schemaVersion:1,updatedAt:new Date(),extra:true}));
});
test('backups are owner-only but currently allow unverified owner writes',async()=>{
 await assertSucceeds(auth(uid,false).doc('users/'+uid+'/backups/latest').set({synthetic:true}));
 await assertFails(auth(other,true).doc('users/'+uid+'/backups/latest').get());
 await assertFails(auth(uid,true).doc('users/'+uid+'/backups/other').set({synthetic:true}));
});
