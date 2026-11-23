const test=require('node:test');
const assert=require('node:assert/strict');
const admin=require('firebase-admin');
const sharp=require('sharp');
const {createBoundFirestoreMessageStore}=require('../../chat/firestore-adapter.cjs');
const {createReservationFinalizer}=require('../../chat/reliable-media-store.cjs');
const {createReliableMediaEmulator}=require('../../chat/reliable-media-emulator.cjs');
const {createEmulatorStorage}=require('../../chat/firebase-storage-emulator.cjs');
let db,bucket,media,service,store;
const convo={id:'chatA',businessId:'ownerA',ownerUid:'ownerA',customerUid:'customerA',status:'open'};
const auth={uid:'customerA',emailVerified:true};
const payload=()=>({auth,conversationId:'chatA',requestId:'photoA',type:'image',declaredMime:'image/png'});
test.before(async()=>{
 assert.ok(process.env.FIRESTORE_EMULATOR_HOST&&process.env.FIREBASE_STORAGE_EMULATOR_HOST);
 admin.initializeApp({projectId:'demo-boustio-phase5913',storageBucket:'demo-boustio-phase5913.appspot.com'});
 db=admin.firestore();bucket=admin.storage().bucket();
 await db.doc('businesses/ownerA/conversations/chatA').set(convo);
 store=createBoundFirestoreMessageStore(db,{businessId:'ownerA'});
 const finalizer=createReservationFinalizer(db,{businessId:'ownerA'});
 media=createEmulatorStorage({bucket,enabled:true,loadConversation:async id=>{
  const s=await db.doc('businesses/ownerA/conversations/'+id).get();return s.exists?{...s.data(),id:s.id}:null;
 }});
 const adapter={...store,...finalizer};
 service=createReliableMediaEmulator({store:adapter,media:{...media,deleteObject:async({storagePath})=>bucket.file(storagePath).delete()},enabled:true,clock:()=>100000});
});
test.after(async()=>{if(admin.apps.length)await admin.app().delete()});
test('real Firebase emulators: concurrent duplicate requests result in one ready message and object',async()=>{
 const bytes=await sharp({create:{width:8,height:8,channels:3,background:'#00ff00'}}).png().toBuffer();
 const [a,b]=await Promise.all([service.send({...payload(),bytes}),service.send({...payload(),bytes})]);
 assert.equal(a.ok,true,JSON.stringify(a));assert.equal(b.ok,true,JSON.stringify(b));
 const snap=await db.doc('businesses/ownerA/conversations/chatA/messages/customerA_photoA').get();
 assert.equal(snap.data().status,'ready');
 const [files]=await bucket.getFiles({prefix:'staging-chat/ownerA/chatA/'});
 assert.equal(files.length,1);
 const again=await service.send({...payload(),bytes});
 assert.equal(again.ok,true);assert.equal(again.duplicate,true);
 const [after]=await bucket.getFiles({prefix:'staging-chat/ownerA/chatA/'});
 assert.equal(after.length,1);
});
test('invalid media marks reservation failed, no object stored',async()=>{
 const result=await service.send({...payload(),requestId:'corrupt1',bytes:Buffer.from('not a png')});
 assert.equal(result.ok,false);
 const snap=await db.doc('businesses/ownerA/conversations/chatA/messages/customerA_corrupt1').get();
 assert.equal(snap.data().status,'failed');
});
test('outsider denied before upload and disabled mode rejects',async()=>{
 const bytes=await sharp({create:{width:4,height:4,channels:3,background:'#000'}}).png().toBuffer();
 assert.equal((await service.send({...payload(),auth:{uid:'outsider',emailVerified:true},requestId:'outsider1',bytes})).code,'NOT_AUTHORIZED');
 const disabled=createReliableMediaEmulator({store:{...store,...createReservationFinalizer(db,{businessId:'ownerA'})},media:{...media,deleteObject:async()=>{}},enabled:false});
 assert.equal((await disabled.send({...payload(),bytes})).code,'MESSAGING_DISABLED');
});
test('launch gates remain open',()=>{
 const gates=require('../../security/phase51-consolidated-gates.json');
 for(const g of Object.values(gates.gates))assert.equal(g.status,'OPEN');
 assert.equal(gates.messaging,false);assert.equal(gates.deployment,false);
});
