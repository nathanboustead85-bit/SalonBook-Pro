"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path");
const {pathToFileURL}=require("node:url");
let create;
test.before(async()=>{create=(await import(pathToFileURL(path.resolve("website/business/dashboard/connection-monitor-foundation.mjs")).href)).createDashboardConnectionMonitor;});
function harness(config={}){
 let onlineFn,viewFn,uid="owner-a",id=0;
 const timers=new Map(),events=[],actions=[];
 const dashboard={
  clear(){actions.push("clear");},
  resume(user){actions.push("resume:"+(user?.uid??"none"));return !!user;}
 };
 const monitor=create({
  dashboard,getCurrentUser:()=>uid?{uid}:null,
  subscribeConnectivity:fn=>{onlineFn=fn;return()=>{onlineFn=null;};},
  subscribeDashboard:fn=>{viewFn=fn;return()=>{viewFn=null;};},
  schedule:(fn,delay)=>{const key=++id;timers.set(key,{fn,delay});return key;},
  cancel:key=>timers.delete(key),
  onStatus:v=>events.push(v),maxAttempts:3,baseDelayMs:100,maxDelayMs:400,...config
 });
 monitor.start();
 return {monitor,timers,events,actions,network:v=>onlineFn(v),view:v=>viewFn(v),
  owner:v=>{uid=v;},tick(){const [key,t]=timers.entries().next().value??[];assert.ok(t,"Expected timer");timers.delete(key);t.fn();return t.delay;}};
}
test("Automatic retry uses bounded exponential backoff and fails closed",()=>{
 const h=harness();h.network(true);
 assert.equal(h.monitor.attempt,1);assert.equal(h.tick(),100);
 assert.equal(h.monitor.attempt,2);assert.equal(h.tick(),200);
 assert.equal(h.monitor.attempt,3);assert.equal(h.tick(),400);
 assert.equal(h.monitor.status,"retry-exhausted");
 assert.equal(h.timers.size,0);
 assert.equal(h.actions.filter(a=>a==="resume:owner-a").length,3);
 h.monitor.stop();
});
test("Fresh dashboard result cancels retries; repeated connectivity events do not duplicate listeners",()=>{
 const h=harness();h.network(true);h.network(true);
 assert.equal(h.actions.filter(a=>a.startsWith("resume:")).length,1);
 h.view({status:"ready",ownerUid:"owner-a"});
 assert.equal(h.monitor.status,"connected");assert.equal(h.timers.size,0);
 h.monitor.stop();
});
test("Offline transition invalidates pending retry and clears private profile",()=>{
 const h=harness();h.network(true);h.network(false);
 assert.equal(h.monitor.status,"offline");assert.equal(h.timers.size,0);
 assert.equal(h.actions.at(-1),"clear");
 h.network(true);
 assert.equal(h.monitor.attempt,1);
 h.monitor.stop();
});
test("Account switch during interruption retries only current authenticated owner",()=>{
 const h=harness();h.network(true);h.owner("owner-b");h.network(false);h.network(true);
 assert.equal(h.actions.at(-1),"resume:owner-b");
 assert.equal(h.actions.filter(a=>a==="resume:owner-a").length,1);
 h.monitor.stop();
});
test("No authentication cannot reconnect; stopping cancels all timers",()=>{
 const h=harness();h.owner(null);h.network(true);
 assert.equal(h.monitor.status,"awaiting-authentication");
 assert.equal(h.timers.size,0);
 h.owner("owner-a");h.network(false);h.network(true);
 assert.equal(h.timers.size,1);
 h.monitor.stop();assert.equal(h.timers.size,0);
 assert.equal(h.monitor.status,"stopped");
});
test("Interrupted listener triggers fresh generation and never preserves stale profile",()=>{
 const h=harness();h.network(true);h.view({status:"interrupted",profile:{businessId:"owner-a"}});
 assert.equal(h.actions.at(-1),"resume:owner-a");
 assert.equal(h.monitor.attempt,1);
 assert.ok(h.actions.filter(a=>a==="clear").length>=3);
 h.monitor.stop();
});
