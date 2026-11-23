const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os'),path=require('node:path');
const sharp=require('sharp');
const {createStagingMediaStore}=require('../chat/staging-media-store.cjs');
const convo={id:'chatA',businessId:'ownerA',ownerUid:'ownerA',customerUid:'customerA',status:'open'};
const auth={uid:'customerA',emailVerified:true};
test('media storage defaults to disabled',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'boustio-media-test-'));
 try{assert.equal((await createStagingMediaStore({root}).upload({auth,conversation:convo})).code,'MEDIA_DISABLED')}
 finally{await fs.rm(root,{recursive:true,force:true})}
});
test('stores sanitized image, permits participant read, denies outsider and traversal',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'boustio-media-test-'));
 try{
  const store=createStagingMediaStore({root,enabled:true});
  const png=await sharp({create:{width:8,height:8,channels:3,background:'#00ff00'}}).png().toBuffer();
  const result=await store.upload({auth,conversation:convo,bytes:png,declaredMime:'image/png',type:'image'});
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.mime,'image/jpeg');
  const read=await store.read({auth,conversation:convo,storagePath:result.storagePath});
  assert.equal(read.ok,true);assert.equal((await sharp(read.bytes).metadata()).format,'jpeg');
  assert.equal((await store.read({auth:{uid:'outsider',emailVerified:true},conversation:convo,storagePath:result.storagePath})).code,'NOT_AUTHORIZED');
  assert.equal((await store.read({auth,conversation:convo,storagePath:'staging-chat/ownerA/chatA/../../secret'})).code,'INVALID_STORAGE_PATH');
  assert.equal((await store.upload({auth:{uid:'outsider',emailVerified:true},conversation:convo,bytes:png,declaredMime:'image/png',type:'image'})).code,'NOT_AUTHORIZED');
 }finally{await fs.rm(root,{recursive:true,force:true})}
});
test('disallows production filesystem root and verifies launch gates remain open',()=>{
 assert.throws(()=>createStagingMediaStore({root:'/tmp/production'}),/DISPOSABLE/);
 const gates=require('../security/phase51-consolidated-gates.json');
 for(const g of Object.values(gates.gates))assert.equal(g.status,'OPEN');
 assert.equal(gates.messaging,false);assert.equal(gates.deployment,false);
});
