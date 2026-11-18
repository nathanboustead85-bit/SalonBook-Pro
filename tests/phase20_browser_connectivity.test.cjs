"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path");
const {pathToFileURL}=require("node:url");
let createBrowserRecoveryIntegration,createDashboardConnectionMonitor;
test.before(async()=>{
 const base=path.resolve("website/business/dashboard");
 createBrowserRecoveryIntegration=(await import(pathToFileURL(path.join(base,"browser-connectivity-foundation.mjs")).href)).createBrowserRecoveryIntegration;
 createDashboardConnectionMonitor=(await import(pathToFileURL(path.join(base,"connection-monitor-foundation.mjs")).href)).createDashboardConnectionMonitor;
});
function setup(initial=true){
 const listeners=new Map(),timers=new Map(),actions=[],statuses=[];
 let online=initial,uid="owner-a",viewCallback,id=0;
 const browser={
  addEventListener:(event,fn)=>{if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn);},
  removeEventListener:(event,fn)=>listeners.get(event)?.delete(fn),
  setTimeout:(fn,delay)=>{const key=++id;timers.set(key,{fn,delay});return key;},
  clearTimeout:key=>timers.delete(key)
 };
 const navigator={get onLine(){return online;}};
 const dashboard={clear:()=>actions.push("clear"),resume:user=>{actions.push("resume:"+(user?.uid??"none"));return !!user;}};
 const monitor=createBrowserRecoveryIntegration({
  windowObject:browser,navigatorObject:navigator,dashboard,
  getCurrentUser:()=>uid?{uid}:null,
  subscribeDashboard:fn=>{viewCallback=fn;return()=>{viewCallback=null;};},
  onStatus:v=>statuses.push(v),createMonitor:createDashboardConnectionMonitor,
  maxAttempts:3,baseDelayMs:100,maxDelayMs:400
 });
 monitor.start();
 return {monitor,listeners,timers,actions,statuses,
  event:(event,value)=>{online=value;for(const fn of [...(listeners.get(event)??[])])fn();},
  owner:value=>{uid=value;},
  view:v=>viewCallback(v),
  tick:()=>{const first=timers.entries().next().value;assert.ok(first);timers.delete(first[0]);first[1].fn();return first[1].delay;}
 };
}
test("Browser initial offline state hides data; reconnect uses current owner",()=>{
 const h=setup(false);assert.equal(h.monitor.status,"offline");
 assert.equal(h.actions.filter(x=>x.startsWith("resume")).length,0);
 h.event("online",true);
 assert.equal(h.actions.at(-1),"resume:owner-a");
 h.monitor.stop();
});
test("Duplicate online events never duplicate retries or listeners",()=>{
 const h=setup();h.event("online",true);h.event("online",true);
 assert.equal(h.actions.filter(x=>x==="resume:owner-a").length,1);
 assert.equal(h.listeners.get("online").size,1);
 h.monitor.stop();
});
test("Offline event clears private state, cancels timer and ignores old ready view",()=>{
 const h=setup();h.event("offline",false);
 assert.equal(h.monitor.status,"offline");assert.equal(h.timers.size,0);
 assert.equal(h.actions.at(-1),"clear");
 h.view({status:"ready",ownerUid:"owner-a"});
 assert.equal(h.monitor.status,"offline");
 h.monitor.stop();
});
test("Repeated browser flaps reattach only current owner and stop cleans listeners",()=>{
 const h=setup();h.event("offline",false);
 h.owner("owner-b");h.event("online",true);
 assert.equal(h.actions.at(-1),"resume:owner-b");
 h.event("offline",false);h.event("online",true);
 assert.equal(h.actions.at(-1),"resume:owner-b");
 h.view({status:"ready",ownerUid:"owner-b"});
 assert.equal(h.monitor.status,"connected");
 h.monitor.stop();
 assert.equal(h.listeners.get("online").size,0);
 assert.equal(h.listeners.get("offline").size,0);
 assert.equal(h.timers.size,0);
});
test("Browser reports online but no verified server snapshot: retries exhaust safely",()=>{
 const h=setup();assert.equal(h.tick(),100);assert.equal(h.tick(),200);assert.equal(h.tick(),400);
 assert.equal(h.monitor.status,"retry-exhausted");
 assert.equal(h.timers.size,0);
 h.monitor.stop();
});
test("Signed-out browser reconnection never attaches private listener",()=>{
 const h=setup(false);h.owner(null);h.event("online",true);
 assert.equal(h.monitor.status,"awaiting-authentication");
 assert.equal(h.actions.some(x=>x.startsWith("resume:")),false);
 h.monitor.stop();
});
test("Unknown navigator connectivity fails closed and unsubscribes safely",()=>{
 const h=setup();h.event("offline",undefined);
 assert.equal(h.monitor.status,"offline");
 h.monitor.stop();
 h.event("online",true);
 assert.equal(h.monitor.status,"stopped");
});
