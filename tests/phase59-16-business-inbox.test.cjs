'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../web/chat');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
test('business inbox includes conversation list, search, unread filters and reply preview',()=>{
 const html=read('business-inbox.html'),js=read('business-inbox.js');
 for(const id of ['search','conversations','unreadCount','messages','customerName','replyForm','replyText','backButton'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(js,/data-filter/);assert.match(js,/renderList/);assert.match(js,/renderDetail/);
 assert.match(html,/Kody Blends/);assert.match(html,/OFFLINE DEMO/);
});
test('mobile layout has an accessible conversation-to-detail navigation',()=>{
 const css=read('business-inbox.css'),html=read('business-inbox.html');
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/show-detail/);
 assert.match(html,/aria-label="Back to conversations"/);
 assert.match(html,/aria-live="polite"/);
});
test('inbox is offline synthetic data, not a production messaging connection',()=>{
 const js=read('business-inbox.js'),html=read('business-inbox.html');
 assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest|WebSocket|firebase|localStorage|sessionStorage|indexedDB/);
 assert.doesNotMatch(js,/innerHTML/);
 assert.match(html,/messages are not sent/);
 assert.match(js,/Intentionally synthetic sample data/);
});
test('all seven production launch blockers remain open',()=>{
 const gates=require('../security/phase51-consolidated-gates.json');
 assert.equal(Object.keys(gates.gates).length,7);
 for(const gate of Object.values(gates.gates))assert.equal(gate.status,'OPEN');
 for(const key of ['messaging','deployment','liveBookings','payments'])assert.equal(gates[key],false);
});
