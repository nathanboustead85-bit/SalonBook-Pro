const test = require('node:test');
const assert = require('node:assert/strict');
const {initializeTestEnvironment,assertFails,assertSucceeds} = require('@firebase/rules-unit-testing');
test('isolated Firestore emulator: owner isolation and anonymous denial',async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-boustio-phase493',firestore:{host:'127.0.0.1',port:8783}});
 try {
  const a=env.authenticatedContext('owner-A').firestore();
  const b=env.authenticatedContext('owner-B').firestore();
  const anon=env.unauthenticatedContext().firestore();
  const own=a.doc('syntheticBusinesses/owner-A/private/test');
  const other=b.doc('syntheticBusinesses/owner-A/private/test');
  await assertSucceeds(own.set({synthetic:true}));
  await assertSucceeds(own.get());
  await assertFails(other.get());
  await assertFails(other.set({synthetic:true}));
  await assertFails(anon.doc('syntheticBusinesses/owner-A/private/test').get());
  await assertFails(anon.doc('syntheticBusinesses/owner-A/private/test').set({synthetic:true}));
 } finally {await env.cleanup();}
});
