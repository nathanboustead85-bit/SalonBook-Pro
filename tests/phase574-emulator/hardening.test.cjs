const {before,after,test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const root=path.resolve(__dirname,'../..');
const owner='phase576-owner',other='phase576-other';
let env;
const db=(id,verified)=>env.authenticatedContext(id,{email_verified:verified}).firestore();
before(async()=>{
 assert.ok(process.env.FIRESTORE_EMULATOR_HOST,'Local Firestore emulator required');
 assert.ok(process.env.GCLOUD_PROJECT?.startsWith('demo-'),'Never run against a live project');
 env=await initializeTestEnvironment({projectId:process.env.GCLOUD_PROJECT,firestore:{rules:fs.readFileSync(path.join(root,'firestore.rules'),'utf8')}});
});
after(async()=>{if(env)await env.cleanup()});
test('backup: current rule permits owner overwrite without verification and schema',async()=>{
 const doc=db(owner,false).doc('users/'+owner+'/backups/latest');
 await assertSucceeds(doc.set({unexpected:'unvalidated'}));
 await assertSucceeds(doc.set({unexpected:'overwritten'}));
 await assertFails(db(other,true).doc('users/'+owner+'/backups/latest').get());
 await assertFails(db(owner,true).doc('users/'+owner+'/backups/not-latest').set({x:1}));
});
test('legacy: absent bookingMode permits write before migration',async()=>{
 const doc=db(owner,true).doc('users/'+owner+'/liveData/bookings');
 await assertSucceeds(doc.set({json:'{}',schemaVersion:1,updatedAt:new Date()}));
});
test('legacy: non-legacy booking mode blocks writes',async()=>{
 const id='phase576-mode';
 await env.withSecurityRulesDisabled(async ctx=>ctx.firestore().doc('businesses/'+id+'/settings/bookingMode').set({mode:'backend'}));
 await assertFails(db(id,true).doc('users/'+id+'/liveData/bookings').set({json:'{}',schemaVersion:1,updatedAt:new Date()}));
});
test('legacy: migration marker blocks writes even when mode legacy',async()=>{
 const id='phase576-migrated';
 await env.withSecurityRulesDisabled(async ctx=>{
  await ctx.firestore().doc('businesses/'+id+'/settings/bookingMode').set({mode:'legacy'});
  await ctx.firestore().doc('businesses/'+id+'/migrations/android-bookings-v1').set({done:true});
 });
 await assertFails(db(id,true).doc('users/'+id+'/liveData/bookings').set({json:'{}',schemaVersion:1,updatedAt:new Date()}));
});
test('services and staff remain writable to verified owner with validated envelope',async()=>{
 const ownerDb=db(owner,true);
 for(const type of ['services','staff']){
  await assertSucceeds(ownerDb.doc('users/'+owner+'/liveData/'+type).set({json:'{}',schemaVersion:1,updatedAt:new Date()}));
  await assertFails(db(owner,false).doc('users/'+owner+'/liveData/'+type).set({json:'{}',schemaVersion:1,updatedAt:new Date()}));
 }
});
test('oversized or malformed liveData payloads rejected',async()=>{
 const doc=db(owner,true).doc('users/'+owner+'/liveData/services');
 await assertFails(doc.set({json:'x'.repeat(500001),schemaVersion:1,updatedAt:new Date()}));
 await assertFails(doc.set({json:'{}',schemaVersion:2,updatedAt:new Date()}));
 await assertFails(doc.set({json:'{}',schemaVersion:1,updatedAt:new Date(),unknown:true}));
});
