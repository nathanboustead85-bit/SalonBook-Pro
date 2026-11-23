const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
let env;
const projectId='demo-boustio-phase594';
const conversation='businesses/owner-a/conversations/conversation-1';
const message=conversation+'/messages/message-1';
before(async()=>{
 env=await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync('../../firestore.rules','utf8')}});
 await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore();
   await db.doc(conversation).set({businessId:'owner-a',customerId:'customer-1'});
   await db.doc(message).set({text:'synthetic test message'});
 });
});
after(async()=>{if(env)await env.cleanup()});
const ctx=(uid,verified)=>env.authenticatedContext(uid,{email_verified:verified}).firestore();
test('verified owner can read own conversation and nested message',async()=>{
 await assertSucceeds(ctx('owner-a',true).doc(conversation).get());
 await assertSucceeds(ctx('owner-a',true).doc(message).get());
});
test('verified owner can list own conversations and messages',async()=>{
 await assertSucceeds(ctx('owner-a',true).collection('businesses/owner-a/conversations').get());
 await assertSucceeds(ctx('owner-a',true).collection(conversation+'/messages').get());
});
test('different verified business owner cannot read or list',async()=>{
 await assertFails(ctx('owner-b',true).doc(conversation).get());
 await assertFails(ctx('owner-b',true).doc(message).get());
 await assertFails(ctx('owner-b',true).collection('businesses/owner-a/conversations').get());
});
test('unverified owner cannot read',async()=>{
 await assertFails(ctx('owner-a',false).doc(conversation).get());
 await assertFails(ctx('owner-a',false).doc(message).get());
});
test('unauthenticated client cannot read',async()=>{
 const db=env.unauthenticatedContext().firestore();
 await assertFails(db.doc(conversation).get());
 await assertFails(db.doc(message).get());
});
test('customer identity cannot read business owner conversations',async()=>{
 await assertFails(ctx('customer-1',true).doc(conversation).get());
 await assertFails(ctx('customer-1',true).doc(message).get());
});
test('even verified owner cannot create update or delete conversation',async()=>{
 const db=ctx('owner-a',true);
 await assertFails(db.collection('businesses/owner-a/conversations').doc('new-conversation').set({businessId:'owner-a'}));
 await assertFails(db.doc(conversation).update({status:'open'}));
 await assertFails(db.doc(conversation).delete());
});
test('even verified owner cannot create update or delete message',async()=>{
 const db=ctx('owner-a',true);
 await assertFails(db.collection(conversation+'/messages').doc('new-message').set({text:'synthetic'}));
 await assertFails(db.doc(message).update({text:'changed'}));
 await assertFails(db.doc(message).delete());
});
test('cross-business writes denied',async()=>{
 const db=ctx('owner-b',true);
 await assertFails(db.doc(message).delete());
 await assertFails(db.doc(conversation).update({status:'changed'}));
});
test('all gates remain open, no production activation',()=>{
 const gates=JSON.parse(fs.readFileSync('../../security/phase51-consolidated-gates.json','utf8'));
 assert.equal(gates.approval,'NOT_APPROVED');
 for(const gate of Object.values(gates.gates))assert.equal(gate.status,'OPEN');
 for(const flag of ['deployment','liveBookings','payments','messaging','appCheckEnforcement'])assert.equal(gates[flag],false);
});
