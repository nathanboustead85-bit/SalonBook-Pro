"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {pathToFileURL}=require("node:url");
const path=require("node:path");
const modulePath=pathToFileURL(path.resolve("website/business/dashboard/session-integration-foundation.mjs")).href;
let createDashboardSessionController;
test.before(async()=>({createDashboardSessionController}=await import(modulePath)));
function harness(){
 let authListener,tokenListener,subscriptions=[],views=[];
 const adapter={
  onAuthStateChanged:(_auth,fn)=>{authListener=fn;return()=>{authListener=null;};},
  onIdTokenChanged:(_auth,fn)=>{tokenListener=fn;return()=>{tokenListener=null;};},
  doc:uid=>uid,
  onSnapshot:(uid,next,error)=>{
   const sub={uid,next,error,active:true};
   subscriptions.push(sub);return()=>{sub.active=false;};
  },
  getIdTokenResult:async user=>({claims:{email_verified:user.verified===true}}),
  onView:v=>views.push(v)
 };
 const controller=()=>createDashboardSessionController(adapter);
 const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
 return {controller,flush,auth:user=>authListener(user),token:user=>tokenListener(user),subscriptions,views};
}
const user=(uid,verified=true)=>({uid,verified});
const profile=uid=>({businessId:uid,name:"Salon "+uid,acceptingBookings:false});
const snapshot=data=>({exists:()=>Boolean(data),data:()=>data});
test("Auth state: unverified users cannot subscribe; verified users can see only their own safe profile",async()=>{
 const h=harness(),c=h.controller();c.start({});
 h.auth(user("owner-a",false));await h.flush();
 assert.equal(c.view.status,"unverified");
 assert.equal(h.subscriptions.length,0);
 h.auth(user("owner-a"));await h.flush();
 assert.equal(h.subscriptions.length,1);
 h.subscriptions[0].next(snapshot(profile("owner-a")));
 assert.equal(c.view.profile.businessId,"owner-a");
 assert.equal(c.view.status,"ready");
 c.stop();
});
test("Sign-out and account switch detach old listener and reject queued stale callbacks",async()=>{
 const h=harness(),c=h.controller();c.start({});
 h.auth(user("owner-a"));await h.flush();
 const old=h.subscriptions[0];
 old.next(snapshot(profile("owner-a")));
 h.auth(null);
 assert.equal(old.active,false);
 assert.equal(c.view.profile,null);
 old.next(snapshot(profile("owner-a")));
 assert.equal(c.view.profile,null);
 h.auth(user("owner-b"));await h.flush();
 const fresh=h.subscriptions[1];
 fresh.next(snapshot(profile("owner-b")));
 old.next(snapshot(profile("owner-a")));
 assert.equal(c.view.ownerUid,"owner-b");
 assert.equal(c.view.profile.businessId,"owner-b");
 c.stop();
});
test("Interrupted listener hides private profile; reconnect creates fresh generation",async()=>{
 const h=harness(),c=h.controller();c.start({});
 h.auth(user("owner-a"));await h.flush();
 const old=h.subscriptions[0];
 old.next(snapshot(profile("owner-a")));
 old.error(Error("offline"));
 assert.equal(c.view.status,"interrupted");
 assert.equal(c.view.profile,null);
 assert.equal(c.reconnect(),true);
 await h.flush();
 assert.equal(old.active,false);
 const next=h.subscriptions[1];
 old.next(snapshot(profile("owner-a")));
 assert.equal(c.view.profile,null);
 next.next(snapshot(profile("owner-a")));
 assert.equal(c.view.status,"ready");
 c.stop();
 assert.equal(next.active,false);
 assert.equal(c.view.profile,null);
 assert.equal(c.reconnect(),false);
});
test("Async verification finishing after account switch cannot subscribe or show old data",async()=>{
 const h=harness();
 let release;
 const gate=new Promise(resolve=>{release=resolve;});
 let first=true;
 const adapters={
  onAuthStateChanged:(_a,fn)=>{h.auth=fn;return()=>{};},
  onIdTokenChanged:()=>()=>{},
  doc:uid=>uid,
  onSnapshot:(uid,next)=>{h.subscriptions.push({uid,next});return()=>{};},
  getIdTokenResult:async u=>{if(first){first=false;await gate;}return {claims:{email_verified:u.verified}};},
  onView:()=>{}
 };
 const c=createDashboardSessionController(adapters);c.start({});
 h.auth(user("owner-a"));
 h.auth(user("owner-b"));
 await h.flush();
 release();await h.flush();
 assert.equal(h.subscriptions.length,1);
 assert.equal(h.subscriptions[0].uid,"owner-b");
 c.stop();
});
test("Invalid profile, listener error and token sign-out fail closed",async()=>{
 const h=harness(),c=h.controller();c.start({});
 h.auth(user("owner-a"));await h.flush();
 h.subscriptions[0].next(snapshot({...profile("owner-a"),acceptingBookings:true}));
 assert.equal(c.view.status,"invalid");
 assert.equal(c.view.profile,null);
 h.token(null);
 assert.equal(c.view.status,"signed-out");
 assert.equal(c.view.profile,null);
 c.stop();
});
