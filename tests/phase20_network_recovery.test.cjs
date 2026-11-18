"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
let createDashboardSessionController,createDashboardNetworkRecovery;
test.before(async()=>{
 createDashboardSessionController=(await import(pathToFileURL(path.resolve("website/business/dashboard/session-integration-foundation.mjs")).href)).createDashboardSessionController;
 createDashboardNetworkRecovery=(await import(pathToFileURL(path.resolve("website/business/dashboard/network-recovery-foundation.mjs")).href)).createDashboardNetworkRecovery;
});
function setup(){
 let authHandler,connectHandler,user={uid:"owner-a"},subs=[],events=[],statuses=[];
 const controller=createDashboardSessionController({
  onAuthStateChanged:(_auth,fn)=>{authHandler=fn;return()=>{};},
  onIdTokenChanged:()=>()=>{},
  getIdTokenResult:async()=>({claims:{email_verified:true}}),
  doc:uid=>uid,
  onSnapshot:(uid,next,error)=>{
   const sub={uid,next,error,active:true};subs.push(sub);
   return()=>{sub.active=false;};
  },
  onView:v=>events.push(v)
 });
 controller.start({});
 const recovery=createDashboardNetworkRecovery({
  dashboard:controller,
  getCurrentUser:()=>user,
  subscribeConnectivity:fn=>{connectHandler=fn;return()=>{connectHandler=null;};},
  onStatus:v=>statuses.push(v)
 });
 recovery.start();
 const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
 const profile=uid=>({businessId:uid,name:"Salon "+uid,acceptingBookings:false});
 const snapshot=data=>({exists:()=>true,data:()=>data});
 return {controller,recovery,subs,events,statuses,flush,profile,snapshot,
  signIn:u=>{user=u;authHandler(u);},
  network:online=>connectHandler(online),
  setUser:u=>{user=u;}
 };
}
test("Network drop immediately hides private profile and detaches listener; stale callbacks cannot restore it",async()=>{
 const h=setup();h.signIn({uid:"owner-a"});await h.flush();
 const first=h.subs[0];first.next(h.snapshot(h.profile("owner-a")));
 assert.equal(h.controller.view.status,"ready");
 h.network(false);
 assert.equal(first.active,false);
 assert.equal(h.controller.view.profile,null);
 first.next(h.snapshot(h.profile("owner-a")));
 assert.equal(h.controller.view.profile,null);
 h.recovery.stop();h.controller.stop();
});
test("Network return resumes fresh authenticated listener without reusing stale data",async()=>{
 const h=setup();h.signIn({uid:"owner-a"});await h.flush();
 const first=h.subs[0];first.next(h.snapshot(h.profile("owner-a")));
 h.network(false);h.network(true);await h.flush();
 assert.equal(h.subs.length,2);
 assert.equal(h.controller.view.profile,null);
 first.next(h.snapshot(h.profile("owner-a")));
 assert.equal(h.controller.view.profile,null);
 h.subs[1].next(h.snapshot(h.profile("owner-a")));
 assert.equal(h.controller.view.status,"ready");
 assert.equal(h.controller.view.profile.businessId,"owner-a");
 h.recovery.stop();h.controller.stop();
});
test("Repeated offline events do not create listeners; account switch while offline restores only new owner",async()=>{
 const h=setup();h.signIn({uid:"owner-a"});await h.flush();
 const old=h.subs[0];
 h.network(false);h.network(false);
 assert.equal(h.subs.length,1);
 h.setUser({uid:"owner-b"});
 h.network(true);await h.flush();
 assert.equal(h.subs.length,2);
 assert.equal(h.subs[1].uid,"owner-b");
 old.next(h.snapshot(h.profile("owner-a")));
 assert.equal(h.controller.view.profile,null);
 h.subs[1].next(h.snapshot(h.profile("owner-b")));
 assert.equal(h.controller.view.profile.businessId,"owner-b");
 h.recovery.stop();h.controller.stop();
});
test("Reconnect without authenticated owner remains signed out; stop prevents further updates",async()=>{
 const h=setup();h.signIn(null);await h.flush();
 h.network(false);h.network(true);await h.flush();
 assert.equal(h.controller.view.profile,null);
 assert.equal(h.statuses.at(-1).status,"awaiting-authentication");
 h.recovery.stop();h.controller.stop();
 const count=h.statuses.length;
 h.recovery.setConnectivity(false);
 assert.equal(h.statuses.length,count);
});
