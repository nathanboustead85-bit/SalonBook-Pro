const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {parseEnvelope,readLocal,restoreSynthetic}=require('./recovery-engine.cjs');
const original={bookings:[{id:'synthetic-a',time:'09:00'},{id:'synthetic-b',time:'10:00'}],services:[{name:'Cut'}],staff:[{name:'Alex'}]};
const envelope=(obj=original)=>({schemaVersion:1,bookings:JSON.stringify(obj.bookings),services:JSON.stringify(obj.services),staff:JSON.stringify(obj.staff)});
function fixture(fn){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'boustio-58-2-'));
 const filename=path.join(dir,'local.json');
 fs.writeFileSync(filename,JSON.stringify(original));
 try{fn(filename,dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}
}
test('valid synthetic recovery preserves appointments and avoids duplicates',()=>fixture(file=>{
 const result=restoreSynthetic(file,envelope());
 assert.deepEqual(result,original);
 assert.deepEqual(readLocal(file),original);
 assert.equal(new Set(result.bookings.map(b=>b.id)).size,2);
}));
test('corrupt backup cannot overwrite local data',()=>fixture(file=>{
 const corrupt={...envelope(),bookings:'{not-json'};
 assert.throws(()=>restoreSynthetic(file,corrupt),/Malformed/);
 assert.deepEqual(readLocal(file),original);
}));
test('unsupported version and missing field cannot overwrite local data',()=>fixture(file=>{
 assert.throws(()=>restoreSynthetic(file,{...envelope(),schemaVersion:2}),/schema/);
 const missing=envelope();delete missing.staff;
 assert.throws(()=>restoreSynthetic(file,missing),/Invalid staff/);
 assert.deepEqual(readLocal(file),original);
}));
test('duplicate synthetic appointment IDs are rejected before commit',()=>fixture(file=>{
 const dup={...original,bookings:[{id:'x'},{id:'x'}]};
 assert.throws(()=>restoreSynthetic(file,envelope(dup)),/Duplicate/);
 assert.deepEqual(readLocal(file),original);
}));
test('simulated interruption before commit rolls back without residue',()=>fixture((file,dir)=>{
 const changed={...original,bookings:[{id:'new-only'}]};
 assert.throws(()=>restoreSynthetic(file,envelope(changed),{failAt:'beforeCommit'}),/interruption/);
 assert.deepEqual(readLocal(file),original);
 assert.deepEqual(fs.readdirSync(dir),['local.json']);
}));
test('complete synthetic replacement is one atomic file operation',()=>fixture(file=>{
 const changed={...original,bookings:[{id:'new-only'}]};
 restoreSynthetic(file,envelope(changed));
 assert.deepEqual(readLocal(file),changed);
}));
test('source Android restore is still preview-only; no app wiring',()=>{
 const src=fs.readFileSync(path.resolve(__dirname,'../../app/src/main/java/com/salonbook/pro/CloudActivity.kt'),'utf8');
 assert.match(src,/Cloud restore preview only/);
 assert.match(src,/Restoring is disabled/);
 assert.doesNotMatch(src,/restoreSynthetic/);
});
