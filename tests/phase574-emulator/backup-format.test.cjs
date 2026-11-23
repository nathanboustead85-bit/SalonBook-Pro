const {before,after,test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const root=path.resolve(__dirname,'../..');
let env;
const db=(id,verified)=>env.authenticatedContext(id,{email_verified:verified}).firestore();
const owner='phase579-owner',other='phase579-other';
const oldFormat={bookings:'[]',services:'[]',staff:'[]',schemaVersion:1};
before(async()=>{
 assert.ok(process.env.FIRESTORE_EMULATOR_HOST,'Local emulator required');
 assert.ok(process.env.GCLOUD_PROJECT?.startsWith('demo-'),'Demo project only');
 env=await initializeTestEnvironment({projectId:process.env.GCLOUD_PROJECT,firestore:{rules:fs.readFileSync(path.join(root,'security/candidates/phase57-9-firestore.rules'),'utf8')}});
});
after(async()=>{if(env)await env.cleanup()});
test('Android four-field backup accepted for verified owner',async()=>{
 const doc=db(owner,true).doc('users/'+owner+'/backups/latest');
 await assertSucceeds(doc.set(oldFormat));
 const snapshot=await doc.get();
 assert.equal(snapshot.data().bookings,'[]');
 await assertSucceeds(doc.set({...oldFormat,updatedAt:new Date()}));
});
test('unverified and cross-account backup writes denied',async()=>{
 await assertFails(db(owner,false).doc('users/'+owner+'/backups/latest').set(oldFormat));
 await assertFails(db(other,true).doc('users/'+owner+'/backups/latest').set(oldFormat));
 await assertFails(db(other,true).doc('users/'+owner+'/backups/latest').get());
});
test('invalid envelope, extra fields and oversized data denied',async()=>{
 const doc=db(owner,true).doc('users/'+owner+'/backups/latest');
 await assertFails(doc.set({bookings:'[]',schemaVersion:1}));
 await assertFails(doc.set({...oldFormat,schemaVersion:2}));
 await assertFails(doc.set({...oldFormat,extra:true}));
 await assertFails(doc.set({...oldFormat,bookings:'x'.repeat(500001)}));
 await assertFails(doc.set({...oldFormat,updatedAt:'not-a-timestamp'}));
 await assertFails(doc.delete());
});
test('no direct appointment or chat write permission introduced',async()=>{
 await assertFails(db(owner,true).doc('businesses/'+owner+'/appointments/a').set({status:'test'}));
 await assertFails(db(owner,true).doc('businesses/'+owner+'/conversations/c/messages/m').set({text:'test'}));
});
