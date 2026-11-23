'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const media=require('../web/chat/media-controls.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('image selection is limited to allowed MIME types and 5 MB',()=>{
 for(const type of ['image/jpeg','image/png','image/webp'])assert.equal(media.validatePhoto({type,size:123}).ok,true);
 for(const type of ['image/svg+xml','text/html','application/pdf','image/gif'])assert.equal(media.validatePhoto({type,size:123}).ok,false);
 assert.equal(media.validatePhoto({type:'image/jpeg',size:5*1024*1024+1}).code,'PHOTO_SIZE');
 assert.equal(media.validatePhoto({type:'image/jpeg',size:0}).ok,false);
});
test('voice selection enforces 60 seconds, 10 MB and accepted formats',()=>{
 for(const type of ['audio/webm','audio/ogg','audio/mp4'])assert.equal(media.validateVoice({type,size:1024},60).ok,true);
 assert.equal(media.validateVoice({type:'audio/webm',size:1024},60.01).code,'VOICE_DURATION');
 assert.equal(media.validateVoice({type:'audio/webm',size:10*1024*1024+1},30).code,'VOICE_SIZE');
 assert.equal(media.validateVoice({type:'audio/mpeg',size:1024},30).code,'VOICE_TYPE');
 assert.equal(media.validateVoice({type:'audio/webm',size:1024},0).ok,false);
});
test('business inbox integrates photo and voice UI with disabled default',()=>{
 const html=read('web/chat/business-inbox.html'),js=read('web/chat/business-inbox.js');
 for(const id of ['businessPhoto','businessRecord','businessMediaPreview','businessMediaStatus'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/media-controls\.js/);
 assert.match(js,/BoustioMediaControls\.mount/);
 assert.match(js,/disabled:\(\)=>!selected\(\)/);
});
test('preview media cannot be uploaded or sent by browser code',()=>{
 for(const path of ['web/chat/media-controls.js','web/chat/business-inbox.js']){
  const js=read(path);
  assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest|WebSocket|firebase|localStorage|sessionStorage|indexedDB|\.upload\s*\(/);
  assert.doesNotMatch(js,/innerHTML/);
 }
});
test('all production launch gates remain open',()=>{
 const gates=require('../security/phase51-consolidated-gates.json');
 assert.equal(Object.keys(gates.gates).length,7);
 for(const gate of Object.values(gates.gates))assert.equal(gate.status,'OPEN');
 for(const key of ['messaging','deployment','payments','liveBookings'])assert.equal(gates[key],false);
});
