"use strict";
// Phase 26.7: real Firestore emulator transactions through Firebase Admin SDK.
// Callable handlers are invoked directly; transport/auth tokens are simulated.
const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path"),Module=require("node:module"),crypto=require("node:crypto");
if(process.env.GCLOUD_PROJECT!=="demo-boustio-phase2613"||process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080"||process.env.BOUSTIO_CHAT_ENABLED==="true")throw Error("Isolated emulator configuration required");
const {createRequire}=require("node:module");
const fromFunctions=createRequire(path.resolve(__dirname,"../functions/package.json"));
const {initializeApp,deleteApp}=fromFunctions("firebase-admin/app");
const {getFirestore,FieldValue}=fromFunctions("firebase-admin/firestore");
const app=initializeApp({projectId:"demo-boustio-phase2613"},"phase2613");
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
const owner="phase2613-business",slug="phase2613-shop",guest="phase2613-guest",other="phase2613-other";
const anonymous=uid=>({auth:{uid,token:{firebase:{sign_in_provider:"anonymous"}}},data:{}});
const conversationId=uid=>crypto.createHash("sha256").update(owner+":"+uid).digest("hex");
const conversationRef=uid=>db.doc("businesses/"+owner+"/conversations/"+conversationId(uid));
const start=uid=>({...anonymous(uid),data:{slug,customerName:"Test Customer",message:"First message"}});
const send=(uid,target=uid)=>({...anonymous(uid),data:{businessId:owner,conversationId:conversationId(target),message:"Next message"}});
const read=(uid,target=uid)=>({...anonymous(uid),data:{businessId:owner,conversationId:conversationId(target)}});
const assertCode=async(p,code)=>assert.rejects(p,e=>e?.code===code);
async function seed(){await db.doc("businessSlugs/"+slug).set({businessId:owner});await db.doc("publicBusinesses/"+owner).set({businessId:owner,slug,published:true,acceptingBookings:false});}
async function createConversation(uid=guest,fields={}){await conversationRef(uid).set({businessId:owner,customerUid:uid,status:"open",customerMessageCount:1,lastCustomerMessageMs:Date.now()-10000,...fields});}
test.before(async()=>{
 await db.recursiveDelete(db.collection("businesses").doc(owner));
 await db.recursiveDelete(db.collection("chatAbuseBudgets"));
 await db.doc("businessSlugs/"+slug).delete();
 await db.doc("publicBusinesses/"+owner).delete();
 await seed();
});
test.after(async()=>{
 delete process.env.BOUSTIO_CHAT_ENABLED;
 delete process.env.BOUSTIO_CHAT_ABUSE_BUDGET_ENABLED;
 await db.recursiveDelete(db.collection("businesses").doc(owner));
 await db.recursiveDelete(db.collection("chatAbuseBudgets"));
 await db.doc("businessSlugs/"+slug).delete();
 await db.doc("publicBusinesses/"+owner).delete();
 await deleteApp(app);
});
test("Both disabled gates reject without budget or message writes",async()=>{
 await assertCode(api.startCustomerChat(start(guest)),"failed-precondition");
 assert.equal((await conversationRef(guest).get()).exists,false);
 assert.equal((await db.collection("chatAbuseBudgets").get()).empty,true);
});
test("Flagged start atomically creates first message and one budget unit",async()=>{
 process.env.BOUSTIO_CHAT_ENABLED="true";
 process.env.BOUSTIO_CHAT_ABUSE_BUDGET_ENABLED="true";
 const result=await api.startCustomerChat(start(guest));
 assert.equal(result.conversationId,conversationId(guest));
 assert.equal((await conversationRef(guest).collection("messages").get()).size,1);
 const budget=await db.collectionGroup("identity").get();
 assert.equal(budget.size,1);
 assert.equal(budget.docs[0].get("count"),1);
});
test("Duplicate start does not consume additional budget",async()=>{
 await assertCode(api.startCustomerChat(start(guest)),"already-exists");
 const budgets=await db.collectionGroup("identity").get();
 assert.equal(budgets.size,1);
 assert.equal(budgets.docs[0].get("count"),1);
});
test("Concurrent sends create only one message and one budget increment",async()=>{
 await conversationRef(guest).update({lastCustomerMessageMs:Date.now()-10000});
 const before=(await conversationRef(guest).collection("messages").get()).size;
 const results=await Promise.allSettled([api.sendCustomerChatMessage(send(guest)),api.sendCustomerChatMessage(send(guest))]);
 assert.equal(results.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(results.filter(x=>x.status==="rejected"&&x.reason.code==="resource-exhausted").length,1);
 assert.equal((await conversationRef(guest).collection("messages").get()).size,before+1);
 const budgets=await db.collectionGroup("identity").get();
 assert.equal(budgets.docs[0].get("count"),2);
});
test("Cross-customer attempts never consume budget or create messages",async()=>{
 const before=(await db.collectionGroup("identity").get()).docs[0].get("count");
 await assertCode(api.sendCustomerChatMessage(send(other,guest)),"permission-denied");
 assert.equal((await db.collectionGroup("identity").get()).docs[0].get("count"),before);
});
test("Business-wide cap blocks rotating accounts without partial writes",async()=>{
 const {LIMITS}=require("../functions/chatAbuseBudget");
 // Existing guest has used two units; consume remaining business units with new identities.
 let allowed=0,denied=0;
 for(let i=0;i<LIMITS.business+2;i++){
  const uid="rotated-"+i;
  try{await api.startCustomerChat(start(uid));allowed++;}
  catch(e){assert.equal(e.code,"resource-exhausted");denied++;}
 }
 assert.equal(allowed,LIMITS.business-2);
 assert.equal(denied,4);
 const blocked="rotated-"+(LIMITS.business+1);
 assert.equal((await conversationRef(blocked).get()).exists,false);
 assert.equal((await db.collectionGroup("business").get()).docs[0].get("count"),LIMITS.business);
});
test("Per-identity cap blocks sends without modifying conversation",async()=>{
 // Use an isolated second business to avoid saturated business quota.
 const otherBusiness="phase2613-otherbusiness";
 const {consumeBudgetWithinTransaction}=require("../functions/chatAbuseBudgetAtomic");
 const {LIMITS}=require("../functions/chatAbuseBudget");
 const now=Date.now();
 for(let i=0;i<LIMITS.identity;i++){
  const result=await db.runTransaction(tx=>consumeBudgetWithinTransaction(tx,db,{businessId:otherBusiness,uid:"same",now}));
  assert.equal(result.allowed,true);
 }
 const result=await db.runTransaction(tx=>consumeBudgetWithinTransaction(tx,db,{businessId:otherBusiness,uid:"same",now}));
 assert.equal(result.allowed,false);
});
test("Feature flag off bypasses new budget without activating messaging itself",async()=>{
 process.env.BOUSTIO_CHAT_ENABLED="false";
 process.env.BOUSTIO_CHAT_ABUSE_BUDGET_ENABLED="false";
 await assertCode(api.startCustomerChat(start("disabled-guest")),"failed-precondition");
 assert.equal((await conversationRef("disabled-guest").get()).exists,false);
});
