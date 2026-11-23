const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const admin=require('firebase-admin');
const {createMessageBackend}=require('../../chat/backend.cjs');
const {createBoundFirestoreMessageStore,createFirestoreMessageStore}=require('../../chat/firestore-adapter.cjs');
let db;
before(async()=>{
 assert.ok(process.env.FIRESTORE_EMULATOR_HOST,'emulator required');
 admin.initializeApp({projectId:'demo-boustio-phase597'});
 db=admin.firestore();
 await db.doc('businesses/ownerA/conversations/chatA').set({businessId:'ownerA',ownerUid:'ownerA',customerUid:'customerA',status:'open'});
 await db.doc('businesses/ownerB/conversations/chatB').set({businessId:'ownerB',ownerUid:'ownerB',customerUid:'customerB',status:'open'});
});
after(async()=>{if(admin.apps.length)await admin.app().delete()});
const request=(id,uid='customerA')=>({auth:{uid,emailVerified:true},conversationId:'chatA',requestId:id,message:{type:'text',text:'Hello from emulator'}});
function backend(owner='ownerA',now=100000){return createMessageBackend({store:createBoundFirestoreMessageStore(db,{businessId:owner}),enabled:true,clock:()=>now})}
test('transactional persistence creates actual Firestore message',async()=>{
 const result=await backend().send(request('persist'));
 assert.equal(result.ok,true);
 const snap=await db.doc('businesses/ownerA/conversations/chatA/messages/customerA_persist').get();
 assert.equal(snap.exists,true);assert.equal(snap.data().text,'Hello from emulator');
});
test('simultaneous duplicate requests persist one message',async()=>{
 const results=await Promise.all(Array.from({length:8},()=>backend().send(request('duplicate'))));
 assert.equal(results.every(r=>r.ok),true);
 assert.equal(results.filter(r=>r.duplicate===false).length,1);
 const snap=await db.doc('businesses/ownerA/conversations/chatA/messages/customerA_duplicate').get();
 assert.equal(snap.exists,true);
});
test('different customers and businesses cannot send into other conversation',async()=>{
 assert.equal((await backend().send(request('intruder','customerB'))).code,'NOT_AUTHORIZED');
 assert.equal((await backend('ownerB').send(request('wrongBusiness'))).code,'CONVERSATION_UNAVAILABLE');
});
test('quota persists transactionally across fresh backend instances',async()=>{
 const now=300000, b=()=>backend('ownerB',now);
 for(let i=0;i<10;i++){
  const r=await b().send({auth:{uid:'customerB',emailVerified:true},conversationId:'chatB',requestId:'quota'+i,message:{type:'text',text:'hi'}});
  assert.equal(r.ok,true,JSON.stringify(r));
 }
 const denied=await b().send({auth:{uid:'customerB',emailVerified:true},conversationId:'chatB',requestId:'quotaExtra',message:{type:'text',text:'hi'}});
 assert.equal(denied.code,'RATE_LIMITED');
});
test('unbound adapter fails closed and cannot infer routing',async()=>{
 const store=createFirestoreMessageStore(db);
 const result=await store.transactMessage({conversationId:'chatA',requestId:'id',actorUid:'customerA'});
 assert.equal(result.code,'ROUTING_NOT_CONFIGURED');
});
test('all production launch gates remain open',()=>{
 const gates=require('../../security/phase51-consolidated-gates.json');
 for(const g of Object.values(gates.gates))assert.equal(g.status,'OPEN');
 assert.equal(gates.messaging,false);assert.equal(gates.deployment,false);
});
