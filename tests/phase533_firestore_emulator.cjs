const test=require('node:test');
const assert=require('node:assert/strict');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
test('Phase 53.3: synthetic owner isolation, verification, writes and collection queries',async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-boustio-phase533',firestore:{host:'127.0.0.1',port:8785}});
 try{
  const ownerA=env.authenticatedContext('owner-A',{email_verified:true}).firestore();
  const ownerB=env.authenticatedContext('owner-B',{email_verified:true}).firestore();
  const unverified=env.authenticatedContext('owner-A',{email_verified:false}).firestore();
  const anon=env.unauthenticatedContext().firestore();
  const aBooking=ownerA.doc('syntheticBusinesses/owner-A/bookings/appointment-1');
  const bBooking=ownerB.doc('syntheticBusinesses/owner-B/bookings/appointment-2');
  const aCustomer=ownerA.doc('syntheticBusinesses/owner-A/clients/customer-1');
  await assertSucceeds(aBooking.set({customer:'synthetic',start:'2026-12-01T10:00:00'}));
  await assertSucceeds(bBooking.set({customer:'synthetic',start:'2026-12-01T11:00:00'}));
  await assertSucceeds(aCustomer.set({name:'synthetic-customer'}));
  await assertSucceeds(aBooking.get());
  await assertSucceeds(aBooking.update({start:'2026-12-01T12:00:00'}));
  await assertSucceeds(ownerA.collection('syntheticBusinesses/owner-A/bookings').get());
  for(const intruder of [ownerB,unverified,anon]){
   for(const p of ['syntheticBusinesses/owner-A/bookings/appointment-1','syntheticBusinesses/owner-A/clients/customer-1']){
    const doc=intruder.doc(p);
    await assertFails(doc.get());
    await assertFails(doc.set({tampered:true}));
    await assertFails(doc.update({tampered:true}));
    await assertFails(doc.delete());
   }
   await assertFails(intruder.collection('syntheticBusinesses/owner-A/bookings').get());
  }
  await assertFails(ownerA.doc('syntheticBusinesses/owner-B/bookings/appointment-2').get());
  await assertFails(ownerA.doc('syntheticBusinesses/owner-B/bookings/appointment-2').delete());
  await assertFails(ownerA.collection('syntheticBusinesses').get());
  await assertFails(ownerA.doc('businesses/owner-A/bookings/appointment-1').set({synthetic:true}));
  await assertFails(ownerA.doc('syntheticBusinesses/owner-A').set({synthetic:true}));
  const final=(await aBooking.get()).data();
  assert.equal(final.start,'2026-12-01T12:00:00');
  assert.equal(final.tampered,undefined);
  assert.equal((await aCustomer.get()).data().name,'synthetic-customer');
 }finally{await env.cleanup()}
});
