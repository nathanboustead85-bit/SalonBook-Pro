const {before,after,test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const root=path.resolve(__dirname,'../..');
let env;
const owner='phase5710-owner';
const backup=(bookings,extras={})=>({bookings:JSON.stringify(bookings),services:'[]',staff:'[]',schemaVersion:1,...extras});
const original=[{id:'synthetic-original-a',start:'2026-11-20T09:00:00'},{id:'synthetic-original-b',start:'2026-11-20T10:00:00'}];
function validatedRestore(snapshot,local,{interruptBeforeCommit=false}={}){
 const candidate=snapshot.data();
 if(!candidate||candidate.schemaVersion!==1)throw Error('unsupported backup');
 const parsed={};
 for(const key of ['bookings','services','staff']){
   if(typeof candidate[key]!=='string'||candidate[key].length>1000000)throw Error('invalid backup field');
   parsed[key]=JSON.parse(candidate[key]);
   if(!Array.isArray(parsed[key]))throw Error('expected array');
 }
 const ids=new Set();
 for(const item of parsed.bookings){
   if(!item||typeof item.id!=='string'||ids.has(item.id))throw Error('duplicate or missing appointment id');
   ids.add(item.id);
 }
 if(interruptBeforeCommit)throw Error('simulated interrupted restore');
 // Synthetic all-or-nothing in-memory commit; not Android persistence.
 return structuredClone(parsed);
}
before(async()=>{
 assert.ok(process.env.FIRESTORE_EMULATOR_HOST,'Emulator required');
 assert.ok(process.env.GCLOUD_PROJECT?.startsWith('demo-'),'Demo-only project required');
 env=await initializeTestEnvironment({projectId:process.env.GCLOUD_PROJECT,firestore:{rules:fs.readFileSync(path.join(root,'security/candidates/phase57-9-firestore.rules'),'utf8')}});
});
after(async()=>{if(env)await env.cleanup()});
test('synthetic legacy v1 backup restores without loss or duplication',async()=>{
 const doc=env.authenticatedContext(owner,{email_verified:true}).firestore().doc('users/'+owner+'/backups/latest');
 await assertSucceeds(doc.set(backup(original)));
 const local={bookings:structuredClone(original),services:[],staff:[]};
 const restored=validatedRestore(await doc.get(),local);
 assert.deepEqual(restored.bookings,original);
 assert.equal(new Set(restored.bookings.map(x=>x.id)).size,2);
 assert.deepEqual(local.bookings,original);
});
test('invalid JSON backup is rejected without modifying synthetic local state',async()=>{
 const doc=env.authenticatedContext(owner,{email_verified:true}).firestore().doc('users/'+owner+'/backups/latest');
 await assertSucceeds(doc.set({...backup(original),bookings:'{invalid'}));
 const local={bookings:structuredClone(original),services:[],staff:[]};
 assert.throws(()=>validatedRestore({data:()=>({bookings:'{invalid',services:'[]',staff:'[]',schemaVersion:1})},local),SyntaxError);
 assert.deepEqual(local.bookings,original);
});
test('simulated interruption before commit leaves synthetic appointments unchanged',()=>{
 const local={bookings:structuredClone(original),services:[],staff:[]};
 assert.throws(()=>validatedRestore({data:()=>backup([{id:'new-only'}])},local,{interruptBeforeCommit:true}),/interrupted/);
 assert.deepEqual(local.bookings,original);
});
test('duplicate appointment ids and unsupported schema rejected',()=>{
 const local={bookings:structuredClone(original),services:[],staff:[]};
 assert.throws(()=>validatedRestore({data:()=>backup([{id:'duplicate'},{id:'duplicate'}])},local),/duplicate/);
 assert.throws(()=>validatedRestore({data:()=>({...backup(original),schemaVersion:2})},local),/unsupported/);
 assert.deepEqual(local.bookings,original);
});
test('owner isolation, no delete, and denied live appointment writes remain enforced',async()=>{
 const other=env.authenticatedContext('phase5710-other',{email_verified:true}).firestore();
 await assertFails(other.doc('users/'+owner+'/backups/latest').get());
 await assertFails(other.doc('users/'+owner+'/backups/latest').set(backup(original)));
 const own=env.authenticatedContext(owner,{email_verified:true}).firestore();
 await assertFails(own.doc('users/'+owner+'/backups/latest').delete());
 await assertFails(own.doc('businesses/'+owner+'/appointments/a').set({id:'a'}));
});
