const test=require('node:test');
const assert=require('node:assert/strict');
const {validateMessage,authorizeParticipant,enforceRateLimit}=require('../chat/security.cjs');
const fs=require('node:fs');
const gates=require('../security/phase51-consolidated-gates.json');
const path='staging-chat/ownerA/conversationA/asset123';
test('text messages accept bounded nonempty text and reject unexpected fields',()=>{
 assert.deepEqual(validateMessage({type:'text',text:' hello '}),{ok:true,type:'text',text:'hello'});
 for(const input of [{type:'text',text:''},{type:'text',text:'x'.repeat(4001)},{type:'text',text:'hi',ownerUid:'forged'},{type:'text',text:'hi',attachment:{}},{type:'other',text:'hi'}])assert.equal(validateMessage(input).ok,false);
});
test('photo metadata restricted to supported MIME, size and isolated path',()=>{
 assert.equal(validateMessage({type:'image',attachment:{mime:'image/jpeg',bytes:1024,storagePath:path}}).ok,true);
 for(const a of [{mime:'image/svg+xml',bytes:1,storagePath:path},{mime:'image/png',bytes:6*1024*1024,storagePath:path},{mime:'image/png',bytes:12,storagePath:'../private'},{mime:'image/png',bytes:12,storagePath:path,untrusted:true}])assert.equal(validateMessage({type:'image',attachment:a}).ok,false);
});
test('voice note duration enforced at 60 seconds inclusive',()=>{
 const a={mime:'audio/webm',bytes:1024,storagePath:path,durationSeconds:60};
 assert.equal(validateMessage({type:'voice',attachment:a}).ok,true);
 for(const durationSeconds of [0,60.001,61,-1,NaN,Infinity])assert.equal(validateMessage({type:'voice',attachment:{...a,durationSeconds}}).ok,false);
 assert.equal(validateMessage({type:'voice',attachment:{...a,bytes:11*1024*1024}}).ok,false);
});
test('conversation authorization prevents cross-business and cross-customer access',()=>{
 const base={ownerUid:'ownerA',customerUid:'customerA',conversationBusinessId:'ownerA'};
 assert.equal(authorizeParticipant({...base,actorUid:'ownerA',actorVerified:true}).ok,true);
 assert.equal(authorizeParticipant({...base,actorUid:'customerA'}).ok,true);
 assert.equal(authorizeParticipant({...base,actorUid:'ownerA',actorVerified:false}).ok,false);
 assert.equal(authorizeParticipant({...base,actorUid:'customerB'}).ok,false);
 assert.equal(authorizeParticipant({...base,actorUid:'ownerB'}).ok,false);
 assert.equal(authorizeParticipant({...base,actorUid:'customerA',conversationBusinessId:'ownerB'}).ok,false);
});
test('fixed window quota blocks burst and future timestamps',()=>{
 assert.equal(enforceRateLimit({recentMessageTimes:Array(10).fill(1000),nowMs:2000}).code,'RATE_LIMITED');
 assert.equal(enforceRateLimit({recentMessageTimes:[1000],nowMs:2000}).ok,true);
 assert.equal(enforceRateLimit({recentMessageTimes:[3000],nowMs:2000}).ok,false);
});
test('module remains isolated from production; release gates stay open',()=>{
 const source=fs.readFileSync('chat/security.cjs','utf8');
 assert.doesNotMatch(source,/firebase-admin|https?:\/\/|Firestore|writeBatch/);
 for(const gate of Object.values(gates.gates))assert.equal(gate.status,'OPEN');
 for(const k of ['deployment','messaging','payments','liveBookings','appCheckEnforcement'])assert.equal(gates[k],false);
});
