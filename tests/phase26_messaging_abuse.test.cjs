"use strict";
// Phase 26.5: direct callable handler tests using synthetic in-memory Firebase doubles.
const test=require("node:test"),assert=require("node:assert/strict"),Module=require("node:module"),path=require("node:path"),fs=require("node:fs");
if(process.env.BOUSTIO_CHAT_ENABLED==="true")throw Error("Audit requires disabled chat at startup");
const records=new Map(),writes=[];let serial=0;
const snapshot=p=>{const data=records.get(p);return {exists:data!==undefined,data:()=>data,get:k=>data?.[k]};};
const reference=p=>({path:p,collection:n=>collection(p+"/"+n),doc:n=>reference(p+"/"+(n||"generated-"+(++serial))),get:async()=>snapshot(p)});
const collection=p=>({doc:n=>reference(p+"/"+(n||"generated-"+(++serial))),orderBy:()=>({limit:()=>({get:async()=>({docs:[...records].filter(([key])=>key.startsWith(p+"/")).map(([key,data])=>({id:key.split("/").at(-1),get:k=>data[k]}))})})})});
const db={collection:n=>collection(n),async runTransaction(fn){
 const staged=[],tx={get:async r=>snapshot(r.path),create:(r,v)=>staged.push(["create",r.path,v]),update:(r,v)=>staged.push(["update",r.path,v]),set:(r,v)=>staged.push(["set",r.path,v]),delete:r=>staged.push(["delete",r.path])};
 const result=await fn(tx);
 for(const [action,p,v] of staged){writes.push([action,p,v]);if(action==="delete")records.delete(p);else records.set(p,action==="update"?{...records.get(p),...v}:v);}
 return result;
}};
class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
const indexPath=path.resolve(__dirname,"../functions/index.js"),original=Module._load;
const mocks={"firebase-functions/v2/https":{onCall:(_options,handler)=>handler,onRequest:(_options,handler)=>handler,HttpsError},"firebase-admin/app":{initializeApp:()=>({})},"firebase-admin/firestore":{getFirestore:()=>db,FieldValue:{serverTimestamp:()=>({synthetic:true}),increment:n=>({increment:n})}}};
let api;
try{Module._load=function(request,parent,isMain){if(Object.hasOwn(mocks,request))return mocks[request];if(parent?.filename===indexPath&&request==="./phase1318PublicBusinessProfile")return {createPublicBusinessHttpHandler:()=>()=>{}};return original.apply(this,arguments);};api=require(indexPath);}finally{Module._load=original;}
const owner="owner-chat",guest="guest-1",other="guest-2",slug="demo-chat",conversation="conversation-123456",base="businesses/"+owner+"/conversations/"+conversation;
const anonymous=uid=>({auth:{uid,token:{firebase:{sign_in_provider:"anonymous"}}},data:{}});
const verified=uid=>({auth:{uid,token:{email_verified:true,firebase:{sign_in_provider:"password"}}},data:{}});
const reset=()=>{records.clear();writes.length=0;serial=0;delete process.env.BOUSTIO_CHAT_ENABLED;};
const enable=()=>{process.env.BOUSTIO_CHAT_ENABLED="true";};
async function deny(fn,request,code){const n=writes.length;await assert.rejects(fn(request),e=>e instanceof HttpsError&&e.code===code);assert.equal(writes.length,n,"Rejected call must not commit synthetic writes");}
const startRequest=(uid=guest,data={})=>({...anonymous(uid),data:{slug,customerName:"Synthetic Customer",message:"Hello",...data}});
const sendRequest=(uid=guest,data={})=>({...anonymous(uid),data:{businessId:owner,conversationId:conversation,message:"Hello again",...data}});
const readRequest=(uid=guest,data={})=>({...anonymous(uid),data:{businessId:owner,conversationId:conversation,...data}});
const seedPublic=()=>{records.set("businessSlugs/"+slug,{businessId:owner});records.set("publicBusinesses/"+owner,{businessId:owner,slug,published:true});};
const seedConversation=(overrides={})=>{records.set(base,{businessId:owner,customerUid:guest,status:"open",customerMessageCount:1,lastCustomerMessageMs:Date.now()-10000,...overrides});};
test.after(()=>delete process.env.BOUSTIO_CHAT_ENABLED);
for(const name of ["startCustomerChat","sendCustomerChatMessage","getCustomerChatMessages"]){
 test(name+" rejects missing auth",async()=>{reset();await deny(api[name],{data:{}},"unauthenticated");});
 test(name+" rejects password-authenticated business owner",async()=>{reset();await deny(api[name],verified(owner),"unauthenticated");});
 test(name+" rejects when live chat flag is disabled",async()=>{reset();await deny(api[name],anonymous(guest),"failed-precondition");});
}
test("Customer chat start rejects unknown business slug",async()=>{reset();enable();await deny(api.startCustomerChat,startRequest(),"not-found");});
test("Customer chat start rejects unpublished business",async()=>{reset();enable();seedPublic();records.set("publicBusinesses/"+owner,{businessId:owner,slug,published:false});await deny(api.startCustomerChat,startRequest(),"not-found");});
test("Customer chat start rejects mismatched public slug",async()=>{reset();enable();seedPublic();records.set("publicBusinesses/"+owner,{businessId:owner,slug:"another-slug",published:true});await deny(api.startCustomerChat,startRequest(),"not-found");});
test("Customer chat start rejects empty message",async()=>{reset();enable();await deny(api.startCustomerChat,startRequest(guest,{message:"   "}),"invalid-argument");});
test("Customer chat start rejects oversized message",async()=>{reset();enable();await deny(api.startCustomerChat,startRequest(guest,{message:"a".repeat(2001)}),"invalid-argument");});
test("Customer chat start rejects oversized customer name",async()=>{reset();enable();await deny(api.startCustomerChat,startRequest(guest,{customerName:"a".repeat(81)}),"invalid-argument");});
test("Customer chat start creates synthetic owner-linked conversation",async()=>{reset();enable();seedPublic();const result=await api.startCustomerChat(startRequest());assert.equal(result.businessId,owner);assert.equal(records.get("businesses/"+owner+"/conversations/"+result.conversationId).customerUid,guest);assert.equal(records.get("businesses/"+owner+"/conversations/"+result.conversationId).customerMessageCount,1);});
test("Repeated guest start rejected without duplicate writes",async()=>{reset();enable();seedPublic();await api.startCustomerChat(startRequest());await deny(api.startCustomerChat,startRequest(),"already-exists");});
test("Separate anonymous guests receive distinct conversation IDs",async()=>{reset();enable();seedPublic();const a=await api.startCustomerChat(startRequest(guest)),b=await api.startCustomerChat(startRequest(other));assert.notEqual(a.conversationId,b.conversationId);});
test("Cross-customer send denied",async()=>{reset();enable();seedConversation();await deny(api.sendCustomerChatMessage,sendRequest(other),"permission-denied");});
test("Cross-business send denied",async()=>{reset();enable();seedConversation();await deny(api.sendCustomerChatMessage,sendRequest(guest,{businessId:"another-business"}),"permission-denied");});
test("Closed conversation cannot receive customer messages",async()=>{reset();enable();seedConversation({status:"closed"});await deny(api.sendCustomerChatMessage,sendRequest(),"permission-denied");});
test("Customer message spam cooldown rejects rapid repeats",async()=>{reset();enable();seedConversation({lastCustomerMessageMs:Date.now()});await deny(api.sendCustomerChatMessage,sendRequest(),"resource-exhausted");});
test("Customer message quota rejects 100th subsequent message",async()=>{reset();enable();seedConversation({customerMessageCount:100});await deny(api.sendCustomerChatMessage,sendRequest(),"resource-exhausted");});
test("Customer send rejects empty message",async()=>{reset();enable();seedConversation();await deny(api.sendCustomerChatMessage,sendRequest(guest,{message:"  "}),"invalid-argument");});
test("Customer send rejects oversized text",async()=>{reset();enable();seedConversation();await deny(api.sendCustomerChatMessage,sendRequest(guest,{message:"x".repeat(2001)}),"invalid-argument");});
test("Customer send rejects invalid conversation path",async()=>{reset();enable();await deny(api.sendCustomerChatMessage,sendRequest(guest,{conversationId:"../other"}),"invalid-argument");});
test("Customer send accepts legitimate message with synthetic writes",async()=>{reset();enable();seedConversation();const result=await api.sendCustomerChatMessage(sendRequest());assert.equal(result.success,true);assert.ok(writes.some(([kind,p])=>kind==="create"&&p.startsWith(base+"/messages/")));});
test("Cross-customer message history read denied",async()=>{reset();enable();seedConversation();await deny(api.getCustomerChatMessages,readRequest(other),"permission-denied");});
test("Cross-business message history read denied",async()=>{reset();enable();seedConversation();await deny(api.getCustomerChatMessages,readRequest(guest,{businessId:"another-business"}),"permission-denied");});
test("Customer can read only own conversation history",async()=>{reset();enable();seedConversation();records.set(base+"/messages/message-1",{senderType:"customer",text:"Synthetic text",createdAt:{toMillis:()=>1000}});const result=await api.getCustomerChatMessages(readRequest());assert.equal(result.messages.length,1);assert.equal(result.messages[0].text,"Synthetic text");});
test("Business reply cannot access another owner's conversation",async()=>{reset();enable();seedConversation();await deny(api.sendBusinessChatReply,{...verified("other-owner"),data:{conversationId:conversation,message:"Hello"}},"not-found");});
test("Business reply rejects closed conversation",async()=>{reset();enable();seedConversation({status:"closed"});await deny(api.sendBusinessChatReply,{...verified(owner),data:{conversationId:conversation,message:"Hello"}},"not-found");});
test("Business reply rejects oversized message",async()=>{reset();enable();seedConversation();await deny(api.sendBusinessChatReply,{...verified(owner),data:{conversationId:conversation,message:"x".repeat(2001)}},"invalid-argument");});
test("Business reply creates text-only synthetic message",async()=>{reset();enable();seedConversation();await api.sendBusinessChatReply({...verified(owner),data:{conversationId:conversation,message:"Hello"}});const msg=writes.find(([kind,p])=>kind==="create"&&p.startsWith(base+"/messages/"));assert.ok(msg);assert.deepEqual(Object.keys(msg[2]).sort(),["businessId","conversationId","createdAt","schemaVersion","senderId","senderType","text"]);});
test("Customer attachment fields cannot create attachment records",async()=>{reset();enable();seedConversation();await api.sendCustomerChatMessage(sendRequest(guest,{photoUrl:"https://invalid.test/photo",voiceUrl:"https://invalid.test/audio",attachment:{type:"image"}}));const msg=writes.find(([kind,p])=>kind==="create"&&p.startsWith(base+"/messages/"));assert.ok(msg);assert.equal(Object.hasOwn(msg[2],"photoUrl"),false);assert.equal(Object.hasOwn(msg[2],"voiceUrl"),false);assert.equal(Object.hasOwn(msg[2],"attachment"),false);});
test("Business attachment fields cannot create attachment records",async()=>{reset();enable();seedConversation();await api.sendBusinessChatReply({...verified(owner),data:{conversationId:conversation,message:"Hello",photoUrl:"https://invalid.test/photo",voiceUrl:"https://invalid.test/audio"}});const msg=writes.find(([kind,p])=>kind==="create"&&p.startsWith(base+"/messages/"));assert.ok(msg);assert.equal(Object.hasOwn(msg[2],"photoUrl"),false);assert.equal(Object.hasOwn(msg[2],"voiceUrl"),false);});
test("Chat has no voice/photo upload callable exports",()=>{reset();for(const key of ["uploadChatPhoto","uploadVoiceMessage","sendVoiceMessage","sendChatAttachment"])assert.equal(Object.hasOwn(api,key),false);});
test("App Check disabled remains a launch blocker",()=>{reset();const src=fs.readFileSync(indexPath,"utf8");assert.match(src,/exports\.startCustomerChat = onCall\([\s\S]*?enforceAppCheck: false/);});
