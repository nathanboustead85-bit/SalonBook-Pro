const {before,after,test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const root=path.resolve(__dirname,'../..');
const owner='phase577-owner',other='phase577-other';
let env;
const db=(id,verified)=>env.authenticatedContext(id,{email_verified:verified}).firestore();
const backup={json:'{}',schemaVersion:1,updatedAt:new Date()};
before(async()=>{
 assert.ok(process.env.FIRESTORE_EMULATOR_HOST,'Local emulator required');
 assert.ok(process.env.GCLOUD_PROJECT?.startsWith('demo-'),'Demo-only project required');
 env=await initializeTestEnvironment({projectId:process.env.GCLOUD_PROJECT,firestore:{rules:fs.readFileSync(path.join(root,'security/candidates/phase57-7-firestore.rules'),'utf8')}});
});
after(async()=>{if(env)await env.cleanup()});
test('candidate rejects unverified backup reads and writes',async()=>{
 await assertFails(db(owner,false).doc('users/'+owner+'/backups/latest').set(backup));
 await assertFails(db(owner,false).doc('users/'+owner+'/backups/latest').get());
});
test('candidate validates backup envelope and owner isolation',async()=>{
 const doc=db(owner,true).doc('users/'+owner+'/backups/latest');
 await assertSucceeds(doc.set(backup));
 await assertSucceeds(doc.get());
 await assertFails(doc.set({unexpected:'old backup format'}));
 await assertFails(doc.set({json:'x'.repeat(500001),schemaVersion:1,updatedAt:new Date()}));
 await assertFails(doc.set({json:'{}',schemaVersion:2,updatedAt:new Date()}));
 await assertFails(doc.delete());
 await assertFails(db(other,true).doc('users/'+owner+'/backups/latest').get());
});
test('candidate denies booking write when booking mode is absent',async()=>{
 await assertFails(db(owner,true).doc('users/'+owner+'/liveData/bookings').set({json:'{}',schemaVersion:1,updatedAt:new Date()}));
});
test('candidate permits explicit legacy mode until migration then blocks',async()=>{
 const id='phase577-legacy';
 await env.withSecurityRulesDisabled(async ctx=>ctx.firestore().doc('businesses/'+id+'/settings/bookingMode').set({mode:'legacy'}));
 const doc=db(id,true).doc('users/'+id+'/liveData/bookings');
 await assertSucceeds(doc.set({json:'{}',schemaVersion:1,updatedAt:new Date()}));
 await env.withSecurityRulesDisabled(async ctx=>ctx.firestore().doc('businesses/'+id+'/migrations/android-bookings-v1').set({done:true}));
 await assertFails(doc.set({json:'{}',schemaVersion:1,updatedAt:new Date()}));
});
test('candidate still prevents direct appointment and messaging writes',async()=>{
 await assertFails(db(owner,true).doc('businesses/'+owner+'/appointments/new').set({x:1}));
 await assertFails(db(owner,true).doc('businesses/'+owner+'/conversations/c1/messages/m1').set({x:1}));
});
