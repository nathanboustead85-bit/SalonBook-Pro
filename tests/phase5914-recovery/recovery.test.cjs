const test=require('node:test'),assert=require('node:assert/strict');
const admin=require('firebase-admin');
const {createMediaRecovery}=require('../../chat/media-recovery.cjs');
let db,bucket,recovery;
const path='businesses/ownerA/conversations/chatA';
test.before(async()=>{
 assert.ok(process.env.FIRESTORE_EMULATOR_HOST&&process.env.FIREBASE_STORAGE_EMULATOR_HOST);
 admin.initializeApp({projectId:'demo-boustio-phase5914',storageBucket:'demo-boustio-phase5914.appspot.com'});
 db=admin.firestore();bucket=admin.storage().bucket();
 await db.doc(path).set({businessId:'ownerA',ownerUid:'ownerA',customerUid:'customerA',status:'open'});
 await db.doc(path+'/messages/customerA_old').set({status:'pending',createdAtMs:1000});
 await db.doc(path+'/messages/customerA_recent').set({status:'pending',createdAtMs:900000});
 await db.doc(path+'/messages/customerA_ready').set({status:'ready',createdAtMs:1000});
 recovery=createMediaRecovery({db,bucket,businessId:'ownerA',clock:()=>1000000,enabled:true});
});
test.after(async()=>{if(admin.apps.length)await admin.app().delete()});
test('stale pending reservation expires transactionally',async()=>{
 const a=await recovery.expirePending({conversationId:'chatA',actorUid:'customerA',requestId:'old'});
 assert.equal(a.ok,true,JSON.stringify(a));
 const snap=await db.doc(path+'/messages/customerA_old').get();
 assert.equal(snap.data().status,'failed');
 assert.equal((await recovery.expirePending({conversationId:'chatA',actorUid:'customerA',requestId:'old'})).code,'NOT_PENDING');
});
test('fresh pending and ready records never expired',async()=>{
 assert.equal((await recovery.expirePending({conversationId:'chatA',actorUid:'customerA',requestId:'recent'})).code,'NOT_STALE');
 assert.equal((await recovery.expirePending({conversationId:'chatA',actorUid:'customerA',requestId:'ready'})).code,'NOT_PENDING');
});
test('orphan sweep dry run does not delete files',async()=>{
 const file=bucket.file('staging-chat/ownerA/chatA/0123456789abcdef0123456789abcdef');
 await file.save(Buffer.from('orphan'),{resumable:false});
 const r=await recovery.sweepOrphans({conversationId:'chatA',dryRun:true});
 assert.equal(r.ok,true);assert.equal(r.deleted.length,0);
 assert.equal((await file.exists())[0],true);
});
test('disabled recovery, cross-business isolation and launch gates',async()=>{
 const disabled=createMediaRecovery({db,bucket,businessId:'ownerA'});
 assert.equal((await disabled.expirePending({conversationId:'chatA',actorUid:'customerA',requestId:'old'})).code,'RECOVERY_DISABLED');
 assert.equal((await recovery.sweepOrphans({conversationId:'other'})).code,'CONVERSATION_UNAVAILABLE');
 const gates=require('../../security/phase51-consolidated-gates.json');
 for(const g of Object.values(gates.gates))assert.equal(g.status,'OPEN');
 assert.equal(gates.messaging,false);assert.equal(gates.deployment,false);
});
