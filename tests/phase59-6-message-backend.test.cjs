const test=require('node:test');
const assert=require('node:assert/strict');
const {createMessageBackend}=require('../chat/backend.cjs');
const fs=require('node:fs');
const auth={uid:'customerA',emailVerified:true};
const convo={id:'chatA',status:'open',ownerUid:'ownerA',customerUid:'customerA',businessId:'ownerA'};
const request={auth,conversationId:'chatA',requestId:'reqA',message:{type:'text',text:' Hello '}};
function fakeStore(initial=convo){
 const messages=new Map(),timestamps=[];
 return {messages,async transactMessage(args){
  const access=args.validateConversation(initial);if(!access.ok)return access;
  const key=args.actorUid+':'+args.requestId;
  if(messages.has(key))return {ok:true,duplicate:true,record:messages.get(key)};
  const quota=args.validateQuota(timestamps);if(!quota.ok)return quota;
  const record=args.makeRecord(access.role);messages.set(key,record);timestamps.push(args.now);
  return {ok:true,duplicate:false,record};
 }};
}
test('messaging defaults to disabled even with a store',async()=>{
 const store=fakeStore();
 assert.deepEqual(await createMessageBackend({store}).send(request),{ok:false,code:'MESSAGING_DISABLED'});
 assert.equal(store.messages.size,0);
});
test('enabled synthetic backend derives sender and membership from trusted context',async()=>{
 const store=fakeStore(),backend=createMessageBackend({store,enabled:true,clock:()=>10000});
 const r=await backend.send(request);assert.equal(r.ok,true);assert.equal(r.record.senderUid,'customerA');assert.equal(r.record.text,'Hello');
 assert.equal(r.record.senderRole,'customer');assert.equal(store.messages.size,1);
});
test('replayed request ID does not create a second message',async()=>{
 const store=fakeStore(),backend=createMessageBackend({store,enabled:true,clock:()=>10000});
 await backend.send(request);const r=await backend.send(request);
 assert.equal(r.duplicate,true);assert.equal(store.messages.size,1);
});
test('reject missing auth, forged message metadata, and unknown conversation IDs',async()=>{
 const backend=createMessageBackend({store:fakeStore(),enabled:true,clock:()=>10000});
 for(const change of [{auth:null},{auth:{uid:'customerA',emailVerified:false}},{message:{type:'text',text:'ok',senderUid:'ownerA'}},{conversationId:'../bad'},{requestId:''}])
  assert.equal((await backend.send({...request,...change})).ok,false);
});
test('cross-business and cross-customer identities denied',async()=>{
 const backend=createMessageBackend({store:fakeStore(),enabled:true,clock:()=>10000});
 for(const uid of ['otherCustomer','otherOwner'])assert.equal((await backend.send({...request,auth:{uid,emailVerified:true}})).code,'NOT_AUTHORIZED');
});
test('closed conversation denied',async()=>{
 const backend=createMessageBackend({store:fakeStore({...convo,status:'closed'}),enabled:true,clock:()=>10000});
 assert.equal((await backend.send(request)).code,'CONVERSATION_UNAVAILABLE');
});
test('10 messages per minute quota enforced by transactional adapter',async()=>{
 const backend=createMessageBackend({store:fakeStore(),enabled:true,clock:()=>10000});
 for(let i=0;i<10;i++)assert.equal((await backend.send({...request,requestId:'req'+i})).ok,true);
 assert.equal((await backend.send({...request,requestId:'reqExtra'})).code,'RATE_LIMITED');
});
test('media cannot be sent without verified upload backend',async()=>{
 const backend=createMessageBackend({store:fakeStore(),enabled:true,clock:()=>10000});
 assert.equal((await backend.send({...request,message:{type:'voice',attachment:{mime:'audio/webm',bytes:500,storagePath:'staging-chat/ownerA/chatA/a',durationSeconds:10}}})).code,'MEDIA_NOT_READY');
});
test('release gates remain open; no live Firebase integration',()=>{
 const gates=require('../security/phase51-consolidated-gates.json');
 for(const g of Object.values(gates.gates))assert.equal(g.status,'OPEN');
 for(const key of ['messaging','deployment','payments','liveBookings','appCheckEnforcement'])assert.equal(gates[key],false);
 assert.doesNotMatch(fs.readFileSync('chat/backend.cjs','utf8'),/firebase-admin|https:\/\/|onRequest\(|onCall\(/);
});
