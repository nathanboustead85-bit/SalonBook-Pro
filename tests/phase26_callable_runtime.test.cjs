"use strict";
// Phase 26.4: execute real callable handlers with isolated in-memory Admin doubles.
// Never import live Firebase Admin, connect to a network, or use credentials.
const test=require("node:test"),assert=require("node:assert/strict"),Module=require("node:module"),path=require("node:path");
if(process.env.BOUSTIO_CHAT_ENABLED==="true")throw Error("Live chat gate must be disabled for this audit");
const records=new Map(),writes=[];
const ref=p=>({path:p,collection(n){return ref(p+"/"+n)},doc(n){return ref(p+"/"+(n||"generated"))},async get(){return snap(p)}});
function snap(p){const data=records.get(p);return {exists:data!==undefined,data:()=>data,get:k=>data?.[k]};}
const db={
 collection:n=>ref(n),
 async runTransaction(fn){
  const staged=[];
  const tx={get:async r=>snap(r.path),set:(r,v)=>staged.push(["set",r.path,v]),update:(r,v)=>staged.push(["update",r.path,v]),create:(r,v)=>staged.push(["create",r.path,v]),delete:r=>staged.push(["delete",r.path])};
  const result=await fn(tx);
  for(const [action,p,v] of staged){writes.push([action,p,v]);if(action==="delete")records.delete(p);else records.set(p,action==="update"?{...records.get(p),...v}:v);}
  return result;
 }
};
class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
const callbacks=new Map(),options=new Map(),original=Module._load;
const mocks={
 "firebase-functions/v2/https":{onCall:(opts,fn)=>{const wrapped=async request=>fn(request);callbacks.set(fn,opts);return wrapped;},onRequest:(_opts,fn)=>fn,HttpsError},
 "firebase-admin/app":{initializeApp:()=>({})},
 "firebase-admin/firestore":{getFirestore:()=>db,FieldValue:{serverTimestamp:()=>({syntheticTimestamp:true}),increment:n=>({syntheticIncrement:n})}},
};
const indexPath=path.resolve(__dirname,"../functions/index.js");
try{
 Module._load=function(request,parent,isMain){
  if(Object.hasOwn(mocks,request))return mocks[request];
  if(parent?.filename===indexPath&&request==="./phase1318PublicBusinessProfile")return {createPublicBusinessHttpHandler:()=>()=>{}};
  if(parent?.filename===indexPath&&request==="./phase1320OwnerCataloguePublish")return {publishOwnerCatalogue:async()=>({status:"BUSINESS_NOT_PUBLISHED"})};
  return original.apply(this,arguments);
 };
 var api=require(indexPath);
}finally{Module._load=original;}
const verified=uid=>({auth:{uid,token:{email_verified:true}},data:{}});
const unverified=uid=>({auth:{uid,token:{email_verified:false}},data:{}});
const owner="runtime-owner",stranger="runtime-stranger",profilePath="users/"+owner+"/business/profile",publicPath="publicBusinesses/"+owner;
const profile=(slug="runtime-shop")=>({businessId:owner,name:"Runtime Shop",slug,category:"Barber",phone:"",address:"",description:""});
function reset(){records.clear();writes.length=0;records.set(profilePath,profile());}
async function denied(fn,request,code){const before=writes.length;await assert.rejects(fn(request),e=>e instanceof HttpsError&&e.code===code);assert.equal(writes.length,before,"Denied request must never commit writes");}
for(const name of ["publishBusiness","unpublishBusiness","publishPublicCatalogue","sendBusinessChatReply","inspectLegacyBookingMigration"]){
 test(name+" denies anonymous caller before writes",async()=>{reset();await denied(api[name],{data:{}},"unauthenticated");});
 test(name+" denies unverified caller before writes",async()=>{reset();await denied(api[name],unverified(owner),"unauthenticated");});
}
test("Publish rejects forged businessId in private profile",async()=>{reset();records.set(profilePath,{...profile(),businessId:stranger});await denied(api.publishBusiness,verified(owner),"failed-precondition");});
test("Publish ignores client-supplied target businessId",async()=>{reset();const req={...verified(owner),data:{businessId:stranger}};const result=await api.publishBusiness(req);assert.equal(result.businessId,owner);assert.equal(records.has("publicBusinesses/"+stranger),false);assert.equal(records.get(publicPath).acceptingBookings,false);});
test("Publish rejects slug already owned by another business",async()=>{reset();records.set("businessSlugs/runtime-shop",{businessId:stranger});await denied(api.publishBusiness,verified(owner),"already-exists");assert.equal(records.has(publicPath),false);});
test("Publish rejects conflicting public slug mapping",async()=>{reset();records.set("publicSlugMappings/runtime-shop",{slug:"runtime-shop",businessId:stranger});await denied(api.publishBusiness,verified(owner),"already-exists");});
test("Publish rejects missing private profile",async()=>{reset();records.delete(profilePath);await denied(api.publishBusiness,verified(owner),"failed-precondition");});
test("Publish rejects malformed slug",async()=>{reset();records.set(profilePath,profile("../bad"));await denied(api.publishBusiness,verified(owner),"invalid-argument");});
test("Successful publish writes only owner's public profile and keeps bookings disabled",async()=>{reset();const result=await api.publishBusiness(verified(owner));assert.equal(result.businessId,owner);assert.equal(records.get(publicPath).published,true);assert.equal(records.get(publicPath).acceptingBookings,false);assert.equal(records.get("publicSlugMappings/runtime-shop").businessId,owner);assert.equal(records.has("publicBusinesses/"+stranger),false);});
test("Unpublish cannot target a different business from request data",async()=>{reset();records.set(publicPath,{businessId:owner,slug:"runtime-shop",published:true,acceptingBookings:false});records.set("publicBusinesses/"+stranger,{published:true,acceptingBookings:false});await api.unpublishBusiness({...verified(owner),data:{businessId:stranger}});assert.equal(records.get(publicPath).published,false);assert.equal(records.get("publicBusinesses/"+stranger).published,true);});
test("Unpublish never enables bookings",async()=>{reset();records.set(publicPath,{businessId:owner,slug:"runtime-shop",published:true,acceptingBookings:false});await api.unpublishBusiness(verified(owner));assert.equal(records.get(publicPath).acceptingBookings,false);});
test("Catalogue rejects client-provided payload",async()=>{reset();await denied(api.publishPublicCatalogue,{...verified(owner),data:{services:[{name:"forged"}]}},"invalid-argument");});
for(const name of ["sendBusinessChatReply","startCustomerChat","sendCustomerChatMessage","getCustomerChatMessages"]){
 test(name+" rejects requests while chat disabled",async()=>{reset();const req=name==="sendBusinessChatReply"?verified(owner):{auth:{uid:"anonymous-a",token:{firebase:{sign_in_provider:"anonymous"}}},data:{}};await denied(api[name],req,"failed-precondition");});
}
test("Customer chat rejects non-anonymous identity",async()=>{reset();await denied(api.startCustomerChat,verified(owner),"unauthenticated");});
test("Runtime publishing App Check enforcement is currently false (risk)",()=>{const src=require("node:fs").readFileSync(indexPath,"utf8");assert.match(src,/enforceAppCheck: false/);});
test("Runtime audit never calls a real Admin SDK",()=>assert.equal(typeof db.runTransaction,"function"));
