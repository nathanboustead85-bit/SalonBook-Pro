"use strict";
// Phase 20.11: actual Chromium browser context offline/online transitions.
// The page uses production recovery foundations with isolated fake dashboard data.
const test=require("node:test"),assert=require("node:assert/strict"),http=require("node:http"),fs=require("node:fs"),path=require("node:path");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
let server,browser,base;
test.before(async()=>{
 server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
  if(pathname==="/"){res.writeHead(200,{"content-type":"text/html"});res.end("<!doctype html><title>Boustio isolated browser test</title>");return;}
  if(!pathname.startsWith("/website/business/dashboard/")){res.writeHead(404);res.end();return;}
  const file=path.resolve(root,"."+pathname);
  if(!file.startsWith(path.join(root,"website","business","dashboard")+path.sep)){res.writeHead(403);res.end();return;}
  try{res.writeHead(200,{"content-type":"text/javascript"});res.end(fs.readFileSync(file));}
  catch{res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 base="http://127.0.0.1:"+server.address().port;
 browser=await chromium.launch({headless:true});
});
test.after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
async function setup(){
 const context=await browser.newContext();
 const page=await context.newPage();await page.goto(base);
 await page.evaluate(async()=>{
  const [{createBrowserRecoveryIntegration},{createDashboardConnectionMonitor}]=await Promise.all([
   import("/website/business/dashboard/browser-connectivity-foundation.mjs"),
   import("/website/business/dashboard/connection-monitor-foundation.mjs")
  ]);
  const state={owner:"owner-a",profile:null,views:[],statuses:[],attempts:[],listeners:0};
  let notifyView;
  const dashboard={
   clear(){state.profile=null;state.listeners=0;},
   resume(user){
    if(!user?.uid)return false;
    state.attempts.push(user.uid);state.listeners=1;return true;
   }
  };
  const monitor=createBrowserRecoveryIntegration({
   windowObject:window,navigatorObject:navigator,dashboard,
   getCurrentUser:()=>state.owner?{uid:state.owner}:null,
   subscribeDashboard:callback=>{notifyView=callback;return()=>{notifyView=null;};},
   onStatus:status=>state.statuses.push(status.status),
   createMonitor:createDashboardConnectionMonitor,
   maxAttempts:3,baseDelayMs:100,maxDelayMs:400
  });
  monitor.start();
  window.__test={
   state,monitor,
   serverSnapshot(uid,name){
    if(state.listeners!==1||navigator.onLine!==true||state.owner!==uid)return false;
    const profile={businessId:uid,name,acceptingBookings:false};
    state.profile=profile;state.views.push(profile);
    notifyView({status:"ready",ownerUid:uid,profile});return true;
   },
   staleSnapshot(uid,name){
    // Simulate queued old listener delivery: detached listeners cannot publish.
    if(state.listeners!==1||state.owner!==uid||!navigator.onLine)return false;
    return this.serverSnapshot(uid,name);
   },
   switchOwner(uid){state.owner=uid;dashboard.clear();},
   stop(){monitor.stop();}
  };
 });
 return {context,page};
}
async function status(page,value){
 await page.waitForFunction(expected=>window.__test.monitor.status===expected,value,{timeout:5000});
}
test("Chromium offline event clears private profile; reconnect waits for fresh owner snapshot",{timeout:30000},async()=>{
 const {context,page}=await setup();
 try{
  assert.equal(await page.evaluate(()=>window.__test.serverSnapshot("owner-a","Before outage")),true);
  await context.setOffline(true);await status(page,"offline");
  assert.equal(await page.evaluate(()=>window.__test.state.profile),null);
  assert.equal(await page.evaluate(()=>window.__test.staleSnapshot("owner-a","Cached")),false);
  await context.setOffline(false);
  await page.waitForFunction(()=>window.__test.state.attempts.length>=2);
  assert.equal(await page.evaluate(()=>window.__test.state.profile),null);
  assert.equal(await page.evaluate(()=>window.__test.serverSnapshot("owner-a","Fresh")),true);
  await status(page,"connected");
  assert.equal(await page.evaluate(()=>window.__test.state.profile.name),"Fresh");
 }finally{await context.close();}
});
test("Chromium repeated offline/online transitions isolate switched owner and detach stale listener",{timeout:30000},async()=>{
 const {context,page}=await setup();
 try{
  await page.evaluate(()=>window.__test.serverSnapshot("owner-a","A"));
  await context.setOffline(true);await status(page,"offline");
  await page.evaluate(()=>window.__test.switchOwner("owner-b"));
  await context.setOffline(false);
  await page.waitForFunction(()=>window.__test.state.attempts.includes("owner-b"));
  assert.equal(await page.evaluate(()=>window.__test.staleSnapshot("owner-a","Leak")),false);
  await context.setOffline(true);await status(page,"offline");
  await context.setOffline(false);
  await page.waitForFunction(()=>window.__test.state.attempts.filter(x=>x==="owner-b").length>=2);
  assert.equal(await page.evaluate(()=>window.__test.serverSnapshot("owner-b","B")),true);
  await status(page,"connected");
  assert.equal(await page.evaluate(()=>window.__test.state.profile.businessId),"owner-b");
  assert.equal(await page.evaluate(()=>window.__test.state.views.some(v=>v.businessId==="owner-a"&&v.name==="Leak")),false);
 }finally{await context.close();}
});
test("Chromium sign-out during outage prevents private reattachment; stop clears data",{timeout:30000},async()=>{
 const {context,page}=await setup();
 try{
  await context.setOffline(true);await status(page,"offline");
  await page.evaluate(()=>window.__test.switchOwner(null));
  await context.setOffline(false);await status(page,"awaiting-authentication");
  assert.equal(await page.evaluate(()=>window.__test.state.listeners),0);
  await page.evaluate(()=>window.__test.stop());
  assert.equal(await page.evaluate(()=>window.__test.monitor.status),"stopped");
  assert.equal(await page.evaluate(()=>window.__test.state.profile),null);
 }finally{await context.close();}
});
