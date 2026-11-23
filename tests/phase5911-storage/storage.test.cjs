const test=require('node:test');
const assert=require('node:assert/strict');
const admin=require('firebase-admin');
const sharp=require('sharp');
const crypto=require('node:crypto');
const {createEmulatorStorage}=require('../../chat/firebase-storage-emulator.cjs');
const convo={id:'chatA',businessId:'ownerA',ownerUid:'ownerA',customerUid:'customerA',status:'open'};
const customer={uid:'customerA',emailVerified:true};
const owner={uid:'ownerA',emailVerified:true};
let bucket;
test.before(()=>{
 assert.ok(process.env.FIREBASE_STORAGE_EMULATOR_HOST,'Firebase Storage emulator must be running');
 admin.initializeApp({projectId:'demo-boustio-phase5911',storageBucket:'demo-boustio-phase5911.appspot.com'});
 bucket=admin.storage().bucket();
});
test.after(async()=>{if(admin.apps.length)await admin.app().delete()});
const make=(enabled=true)=>createEmulatorStorage({bucket,enabled,loadConversation:async id=>id===convo.id?convo:null});
test('disabled by default even with emulator running',async()=>{
 const store=make(false);
 assert.equal((await store.upload({auth:customer,conversationId:'chatA'})).code,'MEDIA_DISABLED');
});
test('real emulator stores sanitized JPEG, participants can download, outsiders denied',async()=>{
 const png=await sharp({create:{width:12,height:12,channels:3,background:'#0000ff'}}).png().toBuffer();
 const store=make();
 const result=await store.upload({auth:customer,conversationId:'chatA',bytes:png,declaredMime:'image/png',type:'image'});
 assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.mime,'image/jpeg');
 const object=bucket.file(result.storagePath);
 const [exists]=await object.exists();assert.equal(exists,true);
 const [metadata]=await object.getMetadata();assert.equal(metadata.contentType,'image/jpeg');
 const read=await store.download({auth:owner,conversationId:'chatA',storagePath:result.storagePath});
 assert.equal(read.ok,true);assert.equal((await sharp(read.bytes).metadata()).format,'jpeg');
 assert.equal(crypto.createHash('sha256').update(read.bytes).digest('hex'),result.sha256);
 assert.equal((await store.download({auth:{uid:'outsider',emailVerified:true},conversationId:'chatA',storagePath:result.storagePath})).code,'NOT_AUTHORIZED');
 assert.equal((await store.download({auth:customer,conversationId:'chatA',storagePath:'staging-chat/ownerA/chatA/../../secret'})).code,'INVALID_STORAGE_PATH');
});
test('unverified identity and unknown conversation denied',async()=>{
 const store=make();
 assert.equal((await store.download({auth:{uid:'customerA',emailVerified:false},conversationId:'chatA',storagePath:'anything'})).code,'AUTH_REQUIRED');
 assert.equal((await store.download({auth:customer,conversationId:'unknown',storagePath:'anything'})).code,'NOT_AUTHORIZED');
});
test('no production deployment or launch gate changes',()=>{
 const gates=require('../../security/phase51-consolidated-gates.json');
 for(const gate of Object.values(gates.gates))assert.equal(gate.status,'OPEN');
 assert.equal(gates.messaging,false);assert.equal(gates.deployment,false);
});
