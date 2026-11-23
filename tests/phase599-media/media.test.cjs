const test=require('node:test');
const assert=require('node:assert/strict');
const sharp=require('sharp');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {mkdtempSync,readFileSync,rmSync}=require('node:fs');
const os=require('node:os'),path=require('node:path');
const {decodeImage,sanitizeImage,probeVoiceDuration,processMediaUpload}=require('../../chat/media-processing.cjs');
const base={ownerUid:'ownerA',conversationId:'chatA'};
test('decodes real PNG pixels, re-encodes JPEG and strips metadata',async()=>{
 const png=await sharp({create:{width:12,height:12,channels:3,background:'#ff0000'}}).png().toBuffer();
 assert.equal(await decodeImage(png,'image/png'),true);
 const r=await processMediaUpload({...base,type:'image',bytes:png,declaredMime:'image/png'});
 assert.equal(r.ok,true);assert.equal(r.mime,'image/jpeg');
 assert.equal((await sharp(r.processedBytes).metadata()).format,'jpeg');
 assert.equal(r.sha256,crypto.createHash('sha256').update(r.processedBytes).digest('hex'));
});
test('rejects forged PNG header with invalid pixel payload',async()=>{
 const fake=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(100)]);
 assert.equal(await decodeImage(fake,'image/png'),false);
 assert.equal((await processMediaUpload({...base,type:'image',bytes:fake,declaredMime:'image/png'})).code,'IMAGE_DECODE_FAILED');
});
test('probes actual short voice file and enforces 60-second limit',async()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'boustio-fixture-'));
 try{
  const short=path.join(dir,'short.webm'),long=path.join(dir,'long.webm');
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','anullsrc=r=8000:cl=mono','-t','1','-c:a','libopus','-y',short],{timeout:20000});
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','anullsrc=r=8000:cl=mono','-t','61','-c:a','libopus','-y',long],{timeout:20000});
  const s=readFileSync(short),l=readFileSync(long);
  assert.ok((await probeVoiceDuration(s,'audio/webm'))>0);
  assert.equal((await processMediaUpload({...base,type:'voice',bytes:s,declaredMime:'audio/webm'})).ok,true);
  assert.equal((await processMediaUpload({...base,type:'voice',bytes:l,declaredMime:'audio/webm'})).code,'INVALID_DURATION');
 }finally{rmSync(dir,{recursive:true,force:true})}
});
test('fails closed on unavailable probe and corrupted audio',async()=>{
 const bytes=Buffer.concat([Buffer.from([0x1a,0x45,0xdf,0xa3]),Buffer.alloc(100)]);
 assert.equal((await processMediaUpload({...base,type:'voice',bytes,declaredMime:'audio/webm'})).code,'INVALID_DURATION');
 assert.equal((await processMediaUpload({...base,type:'voice',bytes,declaredMime:'audio/webm',ffprobe:'/missing/ffprobe'})).code,'INVALID_DURATION');
});
test('production launch flags remain disabled',()=>{
 const gates=require('../../security/phase51-consolidated-gates.json');
 for(const g of Object.values(gates.gates))assert.equal(g.status,'OPEN');
 assert.equal(gates.messaging,false);assert.equal(gates.deployment,false);
});
