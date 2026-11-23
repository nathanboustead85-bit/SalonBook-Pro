'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../web/chat');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
test('responsive premium customer chat includes message, photo and voice controls',()=>{
 const html=read('customer-chat.html'),css=read('customer-chat.css');
 for(const id of ['conversation','composer','message','photoInput','recordButton','voicePreview','attachmentPreview'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(css,/@media\(max-width:540px\)/);
 assert.match(html,/Kody Blends/);assert.match(html,/boustio/);
});
test('offline preview does not contact a server or persist customer messages',()=>{
 const js=read('customer-chat.js'),html=read('customer-chat.html');
 assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest|WebSocket|firebase|localStorage|sessionStorage|indexedDB/);
 assert.doesNotMatch(html,/<script[^>]+src=["']https?:/);
 assert.match(html,/not sent to a business/);
});
test('file type, size and voice recording limits enforced in UI',()=>{
 const js=read('customer-chat.js');
 assert.match(js,/5\*1024\*1024/);assert.match(js,/60000/);
 assert.match(js,/image\/jpeg/);assert.match(js,/image\/png/);assert.match(js,/image\/webp/);
 assert.match(js,/textContent/);assert.doesNotMatch(js,/innerHTML/);
});
test('production gates stay disabled',()=>{
 const gates=require('../security/phase51-consolidated-gates.json');
 for(const g of Object.values(gates.gates))assert.equal(g.status,'OPEN');
 assert.equal(gates.messaging,false);assert.equal(gates.deployment,false);
});
