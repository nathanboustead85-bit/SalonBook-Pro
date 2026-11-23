const test=require('node:test');
const assert=require('node:assert/strict');
const {inspectUpload,detectedMime}=require('../chat/media-validation.cjs');
const fs=require('node:fs');
const base={ownerUid:'ownerA',conversationId:'chatA'};
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(20)]);
const webm=Buffer.concat([Buffer.from([0x1a,0x45,0xdf,0xa3]),Buffer.alloc(20)]);
test('recognises image and audio file signatures, not extensions',()=>{
 assert.equal(detectedMime(png),'image/png');
 assert.equal(detectedMime(webm),'audio/webm');
 assert.equal(detectedMime(Buffer.from('not an image')),null);
});
test('image requires actual trusted decoder confirmation',async()=>{
 const input={...base,type:'image',bytes:png,declaredMime:'image/png'};
 assert.equal((await inspectUpload(input)).code,'IMAGE_DECODER_REQUIRED');
 assert.equal((await inspectUpload({...input,verifyImage:async()=>false})).code,'IMAGE_DECODE_FAILED');
 const r=await inspectUpload({...input,verifyImage:async()=>true});
 assert.equal(r.ok,true);assert.match(r.storagePath,/^staging-chat\/ownerA\/chatA\/[a-f0-9]{32}$/);
 assert.match(r.sha256,/^[a-f0-9]{64}$/);
});
test('voice duration requires trusted probe and rejects longer than 60 seconds',async()=>{
 const input={...base,type:'voice',bytes:webm,declaredMime:'audio/webm'};
 assert.equal((await inspectUpload(input)).code,'DURATION_PROBE_REQUIRED');
 assert.equal((await inspectUpload({...input,probeDuration:async()=>60})).ok,true);
 for(const duration of [0,60.01,61,NaN,Infinity,-1])assert.equal((await inspectUpload({...input,probeDuration:async()=>duration})).code,'INVALID_DURATION');
});
test('mismatched MIME, spoofed bytes, oversized files and path injection denied',async()=>{
 assert.equal((await inspectUpload({...base,type:'image',bytes:png,declaredMime:'image/jpeg',verifyImage:async()=>true})).code,'MIME_MISMATCH');
 assert.equal((await inspectUpload({...base,type:'image',bytes:Buffer.from('hello'),declaredMime:'image/png',verifyImage:async()=>true})).code,'MIME_MISMATCH');
 assert.equal((await inspectUpload({...base,type:'image',bytes:Buffer.alloc(5*1024*1024+1),declaredMime:'image/png',verifyImage:async()=>true})).code,'TOO_LARGE');
 assert.equal((await inspectUpload({...base,conversationId:'../secret',type:'image',bytes:png,declaredMime:'image/png',verifyImage:async()=>true})).code,'INVALID_CONTEXT');
});
test('storage paths are generated and differ per upload',async()=>{
 const input={...base,type:'image',bytes:png,declaredMime:'image/png',verifyImage:async()=>true};
 const a=await inspectUpload(input),b=await inspectUpload(input);
 assert.notEqual(a.storagePath,b.storagePath);assert.equal(a.sha256,b.sha256);
});
test('no live media storage integration or gate changes',()=>{
 const source=fs.readFileSync('chat/media-validation.cjs','utf8');
 assert.doesNotMatch(source,/firebase-admin|storage\.bucket\(|https:\/\/|onRequest\(/);
 const gates=require('../security/phase51-consolidated-gates.json');
 for(const g of Object.values(gates.gates))assert.equal(g.status,'OPEN');
 for(const key of ['messaging','deployment','payments','liveBookings','appCheckEnforcement'])assert.equal(gates[key],false);
});
