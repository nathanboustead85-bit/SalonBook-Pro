"use strict";
// Phase 26.6: concurrency-aware synthetic transactions; no live Firebase access.
const test=require("node:test"),assert=require("node:assert/strict"),Module=require("node:module"),path=require("node:path"),fs=require("node:fs");
if(process.env.BOUSTIO_CHAT_ENABLED==="true")throw Error("Live messaging must remain off in CI");
const records=new Map(),writes=[];let serial=0,queue=Promise.resolve();
const snap=p=>{const d=records.get(p);return {exists:d!==undefined,get:k=>d?.[k],data:()=>d};};
const ref=p=>({path:p,collection:n=>col(p+"/"+n),doc:n=>ref(p+"/"+(n||"synthetic-"+(++serial))),get:async()=>snap(p)});
const col=p=>({doc:n=>ref(p+"/"+(n||"synthetic-"+(++serial)))});
const db={collection:n=>col(n),runTransaction:fn=>{
 const job=queue.then(async()=>{const pending=[],tx={get:async r=>snap(r.path),create:(r,v)=>pending.push(["create",r.path,v]),update:(r,v)=>pending.push(["update",r.path,v]),set:(r,v)=>pending.push(["set",r.path,v]),delete:r=>pending.push(["delete",r.path])};
 const value=await fn(tx);for(const [op,p,v] of pending){if(op==="create"&&records.has(p))throw Error("ALREADY_EXISTS");}
 for(const [op,p,v] of pending){writes.push([op,p,v]);if(op==="delete")records.delete(p);else records.set(p,op==="update"?{...records.get(p),...v}:v);}
 return value;});queue=job.catch(()=>{});return job;
}};
class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
const indexPath=path.resolve(__dirname,"../functions/index.js"),load=Module._load;
let api;
try{Module._load=function(request,parent,isMain){if(request==="firebase-functions/v2/https")return {onCall:(_o,f)=>f,onRequest:(_o,f)=>f,HttpsError};if(request==="firebase-admin/app")return {initializeApp:()=>({})};if(request==="firebase-admin/firestore")return {getFirestore:()=>db,FieldValue:{serverTimestamp:()=>({synthetic:true}),increment:n=>({syntheticIncrement:n})}};if(parent?.filename===indexPath&&request==="./phase1318PublicBusinessProfile")return {createPublicBusinessHttpHandler:()=>()=>{}};return load.apply(this,arguments);};api=require(indexPath);}finally{Module._load=load;}
const owner="business-concurrency",slug="concurrency-shop",guest="guest-alpha",other="guest-beta";
const anon=uid=>({auth:{uid,token:{firebase:{sign_in_provider:"anonymous"}}},data:{}});
const reset=()=>{records.clear();writes.length=0;serial=0;delete process.env.BOUSTIO_CHAT_ENABLED;};
const enabled=()=>{process.env.BOUSTIO_CHAT_ENABLED="true";};
const seedBusiness=()=>{records.set("businessSlugs/"+slug,{businessId:owner});records.set("publicBusinesses/"+owner,{businessId:owner,slug,published:true});};
const start=uid=>({...anon(uid),data:{slug,customerName:"Synthetic Visitor",message:"Hello"}});
const hash=require("node:crypto");const id=uid=>hash.createHash("sha256").update(owner+":"+uid).digest("hex");
const conversation=uid=>"businesses/"+owner+"/conversations/"+id(uid);
const send=uid=>({...anon(uid),data:{businessId:owner,conversationId:id(uid),message:"Hello again"}});
const seedChat=(uid=guest,overrides={})=>records.set(conversation(uid),{businessId:owner,customerUid:uid,status:"open",customerMessageCount:1,lastCustomerMessageMs:Date.now()-10000,...overrides});
async function rejectCode(p,code){await assert.rejects(p,e=>e instanceof HttpsError&&e.code===code);}
test.after(()=>delete process.env.BOUSTIO_CHAT_ENABLED);
test("Messaging is disabled by default for both concurrent requests",async()=>{reset();seedBusiness();const results=await Promise.allSettled([api.startCustomerChat(start(guest)),api.startCustomerChat(start(guest))]);assert.equal(results.filter(r=>r.status==="rejected"&&r.reason.code==="failed-precondition").length,2);assert.equal(writes.length,0);});
test("Simultaneous starts by one guest create exactly one conversation",async()=>{reset();enabled();seedBusiness();const result=await Promise.allSettled([api.startCustomerChat(start(guest)),api.startCustomerChat(start(guest))]);assert.equal(result.filter(r=>r.status==="fulfilled").length,1);assert.equal(result.filter(r=>r.status==="rejected"&&r.reason.code==="already-exists").length,1);assert.equal([...records.keys()].filter(k=>k===conversation(guest)).length,1);assert.equal(writes.filter(([op,p])=>op==="create"&&p===conversation(guest)).length,1);});
test("Concurrent guest starts for different identities remain separate",async()=>{reset();enabled();seedBusiness();const result=await Promise.all([api.startCustomerChat(start(guest)),api.startCustomerChat(start(other))]);assert.notEqual(result[0].conversationId,result[1].conversationId);});
test("Concurrent customer messages are serialized against cooldown",async()=>{reset();enabled();seedChat();const result=await Promise.allSettled([api.sendCustomerChatMessage(send(guest)),api.sendCustomerChatMessage(send(guest))]);assert.equal(result.filter(r=>r.status==="fulfilled").length,1);assert.equal(result.filter(r=>r.status==="rejected"&&r.reason.code==="resource-exhausted").length,1);assert.equal(writes.filter(([op,p])=>op==="create"&&p.startsWith(conversation(guest)+"/messages/")).length,1);});
test("Concurrent messages at quota boundary cannot both pass",async()=>{reset();enabled();seedChat(guest,{customerMessageCount:99});const result=await Promise.allSettled([api.sendCustomerChatMessage(send(guest)),api.sendCustomerChatMessage(send(guest))]);assert.equal(result.filter(r=>r.status==="fulfilled").length,1);assert.equal(result.filter(r=>r.status==="rejected"&&r.reason.code==="resource-exhausted").length,1);});
test("Quota at 100 rejects all simultaneous messages",async()=>{reset();enabled();seedChat(guest,{customerMessageCount:100});const result=await Promise.allSettled([api.sendCustomerChatMessage(send(guest)),api.sendCustomerChatMessage(send(guest))]);assert.equal(result.filter(r=>r.status==="rejected"&&r.reason.code==="resource-exhausted").length,2);assert.equal(writes.length,0);});
test("Other guest cannot access existing conversation under concurrency",async()=>{reset();enabled();seedChat();const results=await Promise.allSettled([api.sendCustomerChatMessage(send(guest)),api.sendCustomerChatMessage({...send(other),data:{...send(other).data,conversationId:id(guest)}})]);assert.equal(results[0].status,"fulfilled");assert.equal(results[1].status,"rejected");assert.equal(results[1].reason.code,"permission-denied");});
test("Anonymous account rotation bypasses per-account duplicate conversation limit (documented risk)",async()=>{reset();enabled();seedBusiness();const identities=["rotating-1","rotating-2","rotating-3"];const result=await Promise.all(identities.map(uid=>api.startCustomerChat(start(uid))));assert.equal(new Set(result.map(r=>r.conversationId)).size,3);assert.equal(result.length,3);});
test("Per-conversation quotas do not provide global account-rotation protection (documented risk)",()=>{reset();assert.equal(id("rotating-1")===id("rotating-2"),false);});
test("Photo payload ignored by text-only start handler",async()=>{reset();enabled();seedBusiness();await api.startCustomerChat({...start(guest),data:{...start(guest).data,photoUrl:"https://example.invalid/image",voiceUrl:"https://example.invalid/audio",attachment:{mime:"image/png"}}});for(const [,p,v] of writes.filter(([op])=>op==="create")){assert.equal(Object.hasOwn(v,"photoUrl"),false);assert.equal(Object.hasOwn(v,"voiceUrl"),false);assert.equal(Object.hasOwn(v,"attachment"),false);}});
test("Voice/photo payload ignored by text-only message handler",async()=>{reset();enabled();seedChat();await api.sendCustomerChatMessage({...send(guest),data:{...send(guest).data,voiceUrl:"https://example.invalid/audio",photoUrl:"https://example.invalid/photo"}});const msg=writes.find(([op,p])=>op==="create"&&p.includes("/messages/"));assert.ok(msg);assert.deepEqual(Object.keys(msg[2]).sort(),["businessId","conversationId","createdAt","schemaVersion","senderId","senderType","text"]);});
test("No callable exports for uploading media",()=>{reset();for(const name of ["uploadChatPhoto","uploadVoiceMessage","sendVoiceMessage","sendChatAttachment"])assert.equal(Object.hasOwn(api,name),false);});
test("Firestore rules keep client chat writes disabled",()=>{const rules=fs.readFileSync(path.resolve(__dirname,"../firestore.rules"),"utf8");const section=rules.slice(rules.indexOf("PHASE 9E.1: PRIVATE CHAT FOUNDATION"));assert.match(section,/allow create, update, delete: if false/);});
test("App Check is not enforced for guest chat (launch blocker)",()=>{const src=fs.readFileSync(indexPath,"utf8");assert.match(src,/exports\.startCustomerChat = onCall\(\s*\{[^}]*enforceAppCheck: false/);});
