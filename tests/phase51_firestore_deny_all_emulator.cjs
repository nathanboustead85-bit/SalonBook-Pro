const test = require('node:test');
const assert = require('node:assert/strict');
const {initializeTestEnvironment, assertFails} = require('@firebase/rules-unit-testing');

test('Phase 51 isolated Firestore emulator denies all client access', async () => {
 const env = await initializeTestEnvironment({projectId:'demo-boustio-phase51',firestore:{host:'127.0.0.1',port:8784}});
 try {
  const contexts = [env.unauthenticatedContext(),env.authenticatedContext('owner-A'),env.authenticatedContext('owner-B', {email_verified:true})];
  for(const context of contexts) {
   const db = context.firestore();
   const own = db.doc('businesses/owner-A/bookings/synthetic-appointment');
   const other = db.doc('businesses/owner-B/bookings/synthetic-appointment');
   for(const doc of [own,other]) {
    await assertFails(doc.get());
    await assertFails(doc.set({synthetic:true}));
    await assertFails(doc.update({synthetic:false}));
    await assertFails(doc.delete());
   }
   await assertFails(db.collection('businesses').get());
  }
  assert.equal(contexts.length,3);
 } finally {await env.cleanup();}
});
