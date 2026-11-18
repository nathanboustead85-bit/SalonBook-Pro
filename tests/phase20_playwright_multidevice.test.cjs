"use strict";
// Phase 20.13: independent Chromium contexts simulate two devices, not actual physical devices.
const test=require("node:test"),assert=require("node:assert/strict"),http=require("node:http"),fs=require("node:fs"),path=require("node:path");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
let server,browser,base;
test.before(async()=>{
 server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,"http://localhost").pathname;
  if(pathname==="/"){res.writeHead(200,{"content-type":"text/html"});res.end("<!doctype html><title>Boustio isolated multi-device tests</title>");return;}
  if(!["session-recovery-foundation.mjs","browser-connectivity-foundation.mjs"].some(x=>pathname==="/website/business/dashboard/"+x)){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":"text/javascript"});res.end(fs.readFileSync(path.join(root,pathname)));
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 base="http://127.0.0.1:"+server.address().port;
 browser=await chromium.launch({headless:true});
});
test.after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
async function device(){
 const context=await browser.newContext(),page=await context.newPage();
 await page.goto(base);
 await page.evaluate(async()=>{
  const {createSessionRecoveryCoordinator}=await import("/website/business/dashboard/session-recovery-foundation.mjs");
  const state={profile:null,uid:null,attached:null,events:[],accepted:[],clears:0,stopped:false};
  let authCallback;
  const dashboard={
   clear(){state.clears++;state.profile=null;state.attached=null;},
   resume(user){state.attached=user.uid;}
  };
  const coordinator=createSessionRecoveryCoordinator({
   dashboard,
   restoreAuthenticatedUser:async()=>state.uid?{uid:state.uid,emailVerified:true}:null,
   subscribeAuth:fn=>{authCallback=fn;return()=>{authCallback=null;};},
   subscribeConnectivity:fn=>{
    const handler=()=>fn(navigator.onLine===true);
    window.addEventListener("online",handler);window.addEventListener("offline",handler);
    fn(navigator.onLine===true);
    return()=>{window.removeEventListener("online",handler);window.removeEventListener("offline",handler);};
   },
   onState:entry=>state.events.push(entry.status)
  });
  coordinator.start();
  window.__device={
   state,coordinator,
   signIn(uid){state.uid=uid;authCallback({uid,emailVerified:true});},
   signOut(){state.uid=null;authCallback(null);},
   receive(uid,name){
    if(!navigator.onLine||state.attached!==uid||state.uid!==uid)return false;
    state.profile={businessId:uid,name};state.accepted.push(name);return true;
   },
   stop(){coordinator.stop();state.stopped=true;}
  };
 });
 return {context,page};
}
async function attach(page,uid){await page.waitForFunction(expected=>window.__device.state.attached===expected,uid);}
async function closeAll(...devices){await Promise.all(devices.map(d=>d.context.close()));}
test("Two Chromium devices keep separate business identities and reject cross-owner snapshots",{timeout:30000},async()=>{
 const a=await device(),b=await device();
 try{
  await a.page.evaluate(()=>window.__device.signIn("owner-a"));
  await b.page.evaluate(()=>window.__device.signIn("owner-b"));
  assert.equal(await a.page.evaluate(()=>window.__device.receive("owner-b","Wrong")),false);
  assert.equal(await b.page.evaluate(()=>window.__device.receive("owner-a","Wrong")),false);
  assert.equal(await a.page.evaluate(()=>window.__device.receive("owner-a","A")),true);
  assert.equal(await b.page.evaluate(()=>window.__device.receive("owner-b","B")),true);
  assert.equal(await a.page.evaluate(()=>window.__device.state.profile.businessId),"owner-a");
  assert.equal(await b.page.evaluate(()=>window.__device.state.profile.businessId),"owner-b");
 }finally{await closeAll(a,b);}
});
test("One device offline clears its private data while the other stays connected",{timeout:30000},async()=>{
 const a=await device(),b=await device();
 try{
  await a.page.evaluate(()=>window.__device.signIn("owner-a"));
  await b.page.evaluate(()=>window.__device.signIn("owner-b"));
  await a.page.evaluate(()=>window.__device.receive("owner-a","Old A"));
  await b.page.evaluate(()=>window.__device.receive("owner-b","B"));
  await a.context.setOffline(true);
  await a.page.waitForFunction(()=>window.__device.state.events.includes("offline"));
  assert.equal(await a.page.evaluate(()=>window.__device.state.profile),null);
  assert.equal(await b.page.evaluate(()=>window.__device.state.profile.name),"B");
  assert.equal(await a.page.evaluate(()=>window.__device.receive("owner-a","Stale")),false);
  await a.context.setOffline(false);await attach(a.page,"owner-a");
  assert.equal(await a.page.evaluate(()=>window.__device.state.profile),null);
  assert.equal(await a.page.evaluate(()=>window.__device.receive("owner-a","Fresh A")),true);
 }finally{await closeAll(a,b);}
});
test("Concurrent sessions for one owner require independent fresh snapshots after outage",{timeout:30000},async()=>{
 const a=await device(),b=await device();
 try{
  await a.page.evaluate(()=>window.__device.signIn("shared-owner"));
  await b.page.evaluate(()=>window.__device.signIn("shared-owner"));
  await a.page.evaluate(()=>window.__device.receive("shared-owner","Old"));
  await b.page.evaluate(()=>window.__device.receive("shared-owner","Old"));
  await a.context.setOffline(true);
  await a.page.waitForFunction(()=>window.__device.state.events.includes("offline"));
  assert.equal(await b.page.evaluate(()=>window.__device.state.profile.name),"Old");
  await b.page.evaluate(()=>window.__device.receive("shared-owner","Updated"));
  await a.context.setOffline(false);await attach(a.page,"shared-owner");
  assert.equal(await a.page.evaluate(()=>window.__device.state.profile),null);
  await a.page.evaluate(()=>window.__device.receive("shared-owner","Updated"));
  assert.equal(await a.page.evaluate(()=>window.__device.state.profile.name),"Updated");
 }finally{await closeAll(a,b);}
});
test("Sign-out and owner switch on one device cannot affect another device's session",{timeout:30000},async()=>{
 const a=await device(),b=await device();
 try{
  await a.page.evaluate(()=>window.__device.signIn("owner-a"));
  await b.page.evaluate(()=>window.__device.signIn("owner-b"));
  await b.page.evaluate(()=>window.__device.receive("owner-b","Private B"));
  await a.page.evaluate(()=>window.__device.signOut());
  assert.equal(await a.page.evaluate(()=>window.__device.receive("owner-a","Leak")),false);
  await a.page.evaluate(()=>window.__device.signIn("owner-c"));
  assert.equal(await a.page.evaluate(()=>window.__device.receive("owner-a","Leak")),false);
  assert.equal(await a.page.evaluate(()=>window.__device.receive("owner-c","C")),true);
  assert.equal(await b.page.evaluate(()=>window.__device.state.profile.name),"Private B");
  await a.page.evaluate(()=>window.__device.stop());
  assert.equal(await a.page.evaluate(()=>window.__device.state.profile),null);
  assert.equal(await b.page.evaluate(()=>window.__device.state.attached),"owner-b");
 }finally{await closeAll(a,b);}
});
