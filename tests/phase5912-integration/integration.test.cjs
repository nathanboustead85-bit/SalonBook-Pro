const test=require('node:test');
const assert=require('node:assert/strict');
const admin=require('firebase-admin');
const sharp=require('sharp');
const {execFileSync}=require('node:child_process');
const {mkdtempSync,readFileSync,rmSync}=require('node:fs');
const path=require('node:path'),os=require('node:os');
const {createBoundFirestoreMessageStore}=require('../../chat/firestore-adapter.cjs');
const {createEmulatorStorage}=require('../../chat/firebase-storage-emulator.cjs');
const {createIntegratedEmulatorChat}=require('../../chat/integrated-emulator-chat.cjs');
const convo={id:'chatA',businessId:'ownerA',ownerUid:'ownerA',customerUid:'customerA',status:'open'};
const customer={uid:'customerA',emailVerified:true},owner={uid:'ownerA',emailVerified:true};
let db,bucket,chat,media;
test.before(async()=>{
 assert.ok(process.env.FIRESTORE_EMULATOR_HOST&&process.env.FIREBASE_STORAGE_EMULATOR_HOST);
 admin.initializeApp({projectId:'demo-boustio-phase5912',storageBucket:'demo-boustio-phase5912.appspot.com'});
 db=admin.firestore();bucket=admin.storage().bucket();
 await db.doc('businesses/ownerA/conversations/chatA').set(convo);
 const store=createBoundFirestoreMessageStore(db,{businessId:'ownerA'});
 media=createEmulatorStorage({bucket,enabled:true,loadConversation:async id=>{
  const snap=await db.doc('businesses/ownerA/conversations/'+id).get();
  return snap.exists?{...snap.data(),id:snap.id}:null;
 }});
 chat=createIntegratedEmulatorChat({store,media,enabled:true,clock:()=>100000});
});
test.after(async()=>{if(admin.apps.length)await admin.app().delete()});
test('real emulator text message creates Firestore record',async()=>{
 const result=await chat.sendText({auth:customer,conversationId:'chatA',requestId:'text1',message:{type:'text',text:'Hello'}});
 assert.equal(result.ok,true,JSON.stringify(result));
 assert.equal((await db.doc('businesses/ownerA/conversations/chatA/messages/customerA_text1').get()).data().text,'Hello');
});
test('real emulator photo upload creates linked message and private sanitized object',async()=>{
 const png=await sharp({create:{width:8,height:8,channels:3,background:'#00ff00'}}).png().toBuffer();
 const result=await chat.sendMedia({auth:owner,conversationId:'chatA',requestId:'photo1',bytes:png,declaredMime:'image/png',type:'image'});
 assert.equal(result.ok,true,JSON.stringify(result));
 const msg=(await db.doc('businesses/ownerA/conversations/chatA/messages/ownerA_photo1').get()).data();
 assert.equal(msg.type,'image');assert.equal(msg.attachment.mime,'image/jpeg');
 const downloaded=await media.download({auth:customer,conversationId:'chatA',storagePath:msg.attachment.storagePath});
 assert.equal(downloaded.ok,true);assert.equal((await sharp(downloaded.bytes).metadata()).format,'jpeg');
});
test('real emulator voice upload creates message and verifies duration',async()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'boustio-voice-fixture-'));
 try{
  const file=path.join(dir,'voice.webm');
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','anullsrc=r=8000:cl=mono','-t','1','-c:a','libopus','-y',file],{timeout:20000});
  const result=await chat.sendMedia({auth:customer,conversationId:'chatA',requestId:'voice1',bytes:readFileSync(file),declaredMime:'audio/webm',type:'voice'});
  assert.equal(result.ok,true,JSON.stringify(result));
  const msg=(await db.doc('businesses/ownerA/conversations/chatA/messages/customerA_voice1').get()).data();
  assert.equal(msg.type,'voice');assert.equal(msg.attachment.mime,'audio/webm');
 }finally{rmSync(dir,{recursive:true,force:true})}
});
test('outsider cannot send media or text',async()=>{
 const stranger={uid:'outsider',emailVerified:true};
 const a=await chat.sendText({auth:stranger,conversationId:'chatA',requestId:'bad1',message:{type:'text',text:'bad'}});
 assert.equal(a.code,'NOT_AUTHORIZED');
 const png=await sharp({create:{width:4,height:4,channels:3,background:'#000000'}}).png().toBuffer();
 const b=await chat.sendMedia({auth:stranger,conversationId:'chatA',requestId:'bad2',bytes:png,declaredMime:'image/png',type:'image'});
 assert.equal(b.code,'NOT_AUTHORIZED');
});
test('disabled integration denies all sends and gates remain open',async()=>{
 const store=createBoundFirestoreMessageStore(db,{businessId:'ownerA'});
 const disabled=createIntegratedEmulatorChat({store,media,enabled:false});
 assert.equal((await disabled.sendText({auth:customer})).code,'MESSAGING_DISABLED');
 assert.equal((await disabled.sendMedia({auth:customer})).code,'MESSAGING_DISABLED');
 const gates=require('../../security/phase51-consolidated-gates.json');
 for(const g of Object.values(gates.gates))assert.equal(g.status,'OPEN');
 assert.equal(gates.messaging,false);assert.equal(gates.deployment,false);
});
