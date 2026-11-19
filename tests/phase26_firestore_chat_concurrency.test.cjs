"use strict";
// Phase 26.7: real Firestore emulator transactions through Firebase Admin SDK.
// Callable handlers are invoked directly; transport/auth tokens are simulated.
const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path"),Module=require("node:module"),crypto=require("node:crypto");
if(process.env.GCLOUD_PROJECT!=="demo-boustio-phase267"||process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080"||process.env.BOUSTIO_CHAT_ENABLED==="true")throw Error("Isolated emulator configuration required");
const {createRequire}=require("node:module");
const fromFunctions=createRequire(path.resolve(__dirname,"../functions/package.json"));
const {initializeApp,deleteApp}=fromFunctions("firebase-admin/app");
const {getFirestore,FieldValue}=fromFunctions("firebase-admin/firestore");
const app=initializeApp({projectId:"demo-boustio-phase267"},"phase267");
const db=getFirestore(app);
class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
const indexPath=path.resolve(__dirname,"../functions/index.js"),original=Module._load;
let api;
try{
 Module._load=function(request,parent,isMain){
  if(parent?.filename===indexPath&&request==="firebase-functions/v2/https")return {onCall:(_options,handler)=>handler,onRequest:(_options,handler)=>handler,HttpsError};
  if(parent?.filename===indexPath&&request==="firebase-admin/app")return {initializeApp:()=>app};
  if(parent?.filename===indexPath&&request==="firebase-admin/firestore")return {getFirestore:()=>db,FieldValue};
  if(parent?.filename===indexPath&&request==="./phase1318PublicBusinessProfile")return {createPublicBusinessHttpHandler:()=>()=>{}};
  return original.apply(this,arguments);
 };
 api=require(indexPath);
}finally{Module._load=original;}
const owner="phase267-business",slug="phase267-shop",guest="phase267-guest",other="phase267-other";
const anonymous=uid=>({auth:{uid,token:{firebase:{sign_in_provider:"anonymous"}}},data:{}});
const conversationId=uid=>crypto.createHash("sha256").update(owner+":"+uid).digest("hex");
const conversationRef=uid=>db.doc("businesses/"+owner+"/conversations/"+conversationId(uid));
const start=uid=>({...anonymous(uid),data:{slug,customerName:"Test Customer",message:"First message"}});
const send=(uid,target=uid)=>({...anonymous(uid),data:{businessId:owner,conversationId:conversationId(target),message:"Next message"}});
const read=(uid,target=uid)=>({...anonymous(uid),data:{businessId:owner,conversationId:conversationId(target)}});
const assertCode=async(p,code)=>assert.rejects(p,e=>e?.code===code);
async function seed(){await db.doc("businessSlugs/"+slug).set({businessId:owner});await db.doc("publicBusinesses/"+owner).set({businessId:owner,slug,published:true,acceptingBookings:false});}
async function createConversation(uid=guest,fields={}){await conversationRef(uid).set({businessId:owner,customerUid:uid,status:"open",customerMessageCount:1,lastCustomerMessageMs:Date.now()-10000,...fields});}
test.before(async()=>{await db.recursiveDelete(db.collection("businesses").doc(owner));await db.doc("businessSlugs/"+slug).delete();await db.doc("publicBusinesses/"+owner).delete();await seed();});
test.after(async()=>{delete process.env.BOUSTIO_CHAT_ENABLED;await db.recursiveDelete(db.collection("businesses").doc(owner));await db.doc("businessSlugs/"+slug).delete();await db.doc("publicBusinesses/"+owner).delete();await deleteApp(app);});
test("Disabled gate blocks start without writes",async()=>{await assertCode(api.startCustomerChat(start(guest)),"failed-precondition");assert.equal((await conversationRef(guest).get()).exists,false);});
test("Concurrent starts use real Firestore transaction conflict protection",async()=>{
 process.env.BOUSTIO_CHAT_ENABLED="true";
 const results=await Promise.allSettled([api.startCustomerChat(start(guest)),api.startCustomerChat(start(guest))]);
 assert.equal(results.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(results.filter(x=>x.status==="rejected"&&x.reason.code==="already-exists").length,1);
 const c=await conversationRef(guest).get();assert.equal(c.get("customerMessageCount"),1);
 const messages=await conversationRef(guest).collection("messages").get();assert.equal(messages.size,1);
});
test("Different guest identities create distinct conversations",async()=>{const result=await api.startCustomerChat(start(other));assert.equal(result.conversationId,conversationId(other));assert.notEqual(result.conversationId,conversationId(guest));});
test("Concurrent sends enforce real transaction cooldown and single write",async()=>{
 await conversationRef(guest).update({lastCustomerMessageMs:Date.now()-10000,customerMessageCount:5});
 const before=(await conversationRef(guest).collection("messages").get()).size;
 const results=await Promise.allSettled([api.sendCustomerChatMessage(send(guest)),api.sendCustomerChatMessage(send(guest))]);
 assert.equal(results.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(results.filter(x=>x.status==="rejected"&&x.reason.code==="resource-exhausted").length,1);
 assert.equal((await conversationRef(guest).get()).get("customerMessageCount"),6);
 assert.equal((await conversationRef(guest).collection("messages").get()).size,before+1);
});
test("Real transaction quota boundary rejects second concurrent send",async()=>{
 await conversationRef(guest).update({lastCustomerMessageMs:Date.now()-10000,customerMessageCount:99});
 const results=await Promise.allSettled([api.sendCustomerChatMessage(send(guest)),api.sendCustomerChatMessage(send(guest))]);
 assert.equal(results.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(results.filter(x=>x.status==="rejected"&&x.reason.code==="resource-exhausted").length,1);
 assert.equal((await conversationRef(guest).get()).get("customerMessageCount"),100);
});
test("At quota 100 all parallel sends are rejected",async()=>{
 const before=(await conversationRef(guest).collection("messages").get()).size;
 const results=await Promise.allSettled([api.sendCustomerChatMessage(send(guest)),api.sendCustomerChatMessage(send(guest))]);
 assert.equal(results.filter(x=>x.status==="rejected"&&x.reason.code==="resource-exhausted").length,2);
 assert.equal((await conversationRef(guest).collection("messages").get()).size,before);
});
test("Cross-customer send is denied by real backend ownership check",async()=>{await assertCode(api.sendCustomerChatMessage(send(other,guest)),"permission-denied");});
test("Cross-customer read is denied by real backend ownership check",async()=>{await assertCode(api.getCustomerChatMessages(read(other,guest)),"permission-denied");});
test("Anonymous rotation creates additional conversations: launch blocker",async()=>{
 const rotated="phase267-rotated";const result=await api.startCustomerChat(start(rotated));
 assert.notEqual(result.conversationId,conversationId(guest));
 assert.equal((await conversationRef(rotated).get()).get("customerUid"),rotated);
});
test("Client chat writes remain disabled in Firestore rules (separate rule suite)",()=>{const rules=require("node:fs").readFileSync(path.resolve(__dirname,"../firestore.rules"),"utf8");assert.match(rules,/match \/businesses\/\{businessId\}\/conversations\/\{conversationId\}/);});
test("App Check remains disabled: documented launch blocker",()=>{const source=require("node:fs").readFileSync(indexPath,"utf8");assert.match(source,/exports\.startCustomerChat = onCall\(\s*\{[^}]*enforceAppCheck: false/);});
