const {before,after,test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const root=path.resolve(__dirname,'../..');
const src=fs.readFileSync(path.join(root,'app/src/main/java/com/salonbook/pro/CloudActivity.kt'),'utf8');
let env;
before(async()=>{
 assert.ok(process.env.FIRESTORE_EMULATOR_HOST,'Firestore emulator required');
 assert.ok(process.env.GCLOUD_PROJECT?.startsWith('demo-'),'Demo-only project');
 env=await initializeTestEnvironment({projectId:process.env.GCLOUD_PROJECT,firestore:{rules:fs.readFileSync(path.join(root,'security/candidates/phase57-7-firestore.rules'),'utf8')}});
});
after(async()=>{if(env)await env.cleanup()});
test('Android restore expects distinct bookings/services/staff string fields',()=>{
 for(const key of ['bookings','services','staff'])assert.ok(src.includes('document.getString("'+key+'")'));
 assert.ok(src.includes('document.getLong("schemaVersion")'));
});
test('Android cloud backup and restore are preview-only, with no cloud write or local overwrite',()=>{
 assert.ok(src.includes('private fun backup()'));
 assert.ok(src.includes('private fun restore()'));
 assert.ok(src.includes('Cloud backup is disabled'));
 assert.ok(src.includes('Restoring is disabled'));
 assert.ok(!/backupDocument\(uid\)\s*\.set\(/.test(src));
 assert.ok(!/prefs\.edit\(\)/.test(src));
});
test('Phase 57.7 candidate rejects Android expected backup shape',async()=>{
 const db=env.authenticatedContext('phase578-owner',{email_verified:true}).firestore();
 const doc=db.doc('users/phase578-owner/backups/latest');
 await assertFails(doc.set({bookings:'[]',services:'[]',staff:'[]',schemaVersion:1}));
 await assertSucceeds(doc.set({json:'{}',schemaVersion:1,updatedAt:new Date()}));
});
test('cross-owner backup access still rejected by candidate',async()=>{
 const db=env.authenticatedContext('phase578-other',{email_verified:true}).firestore();
 await assertFails(db.doc('users/phase578-owner/backups/latest').get());
});
