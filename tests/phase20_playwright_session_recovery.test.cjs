"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),http=require("node:http"),fs=require("node:fs"),path=require("node:path");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
let server,browser,url;
test.before(async()=>{
 server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,"http://localhost").pathname;
  if(pathname==="/"){res.writeHead(200,{"content-type":"text/html"});res.end("<!doctype html><title>Isolated Boustio session tests</title>");return;}
  if(pathname!=="/website/business/dashboard/session-recovery-foundation.mjs"){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":"text/javascript"});res.end(fs.readFileSync(path.join(root,pathname)));
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 url="http://127.0.0.1:"+server.address().port;
 browser=await chromium.launch({headless:true});
});
test.after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
async function load(page){
 await page.goto(url);
 await page.evaluate(async()=>{
  const {createSessionRecoveryCoordinator}=await import("/website/business/dashboard/session-recovery-foundation.mjs");
  const state={profile:null,attached:null,events:[],active:0,restores:0};
  let authCallback,networkCallback;
  const dashboard={
   clear(){state.profile=null;state.attached=null;state.active=0;},
   resume(user){state.attached=user.uid;state.active=1;}
  };
  const coordinator=createSessionRecoveryCoordinator({
   dashboard,
   restoreAuthenticatedUser:async()=>{
    state.restores++;
    const token=sessionStorage.getItem("verified-auth-token");
    if(!token)return null;
    // Test-only mock verification; never interpret this as production authentication.
    return {uid:token,emailVerified:true};
   },
   subscribeAuth:fn=>{authCallback=fn;return()=>{authCallback=null;};},
   subscribeConnectivity:fn=>{
    networkCallback=fn;fn(navigator.onLine===true);
    const online=()=>fn(navigator.onLine===true);
    const offline=()=>fn(navigator.onLine===true);
    window.addEventListener("online",online);window.addEventListener("offline",offline);
    return()=>{networkCallback=null;window.removeEventListener("online",online);window.removeEventListener("offline",offline);};
   },
   onState:entry=>state.events.push(entry.status)
  });
  coordinator.start();
  window.__session={
   state,coordinator,
   signIn(uid){sessionStorage.setItem("verified-auth-token",uid);authCallback({uid,emailVerified:true});},
   signOut(){sessionStorage.removeItem("verified-auth-token");authCallback(null);},
   serverSnapshot(uid,name){
    if(navigator.onLine!==true||state.attached!==uid)return false;
    state.profile={businessId:uid,name};return true;
   },
   network:online=>networkCallback(online)
  };
 });
}
async function attached(page,uid){await page.waitForFunction(expected=>window.__session.state.attached===expected,uid);}
test("Chromium reload restores verified session but never restores cached private profile",{timeout:30000},async()=>{
 const context=await browser.newContext(),page=await context.newPage();
 try{
  await load(page);await page.evaluate(()=>window.__session.signIn("owner-a"));
  assert.equal(await page.evaluate(()=>window.__session.serverSnapshot("owner-a","Before reload")),true);
  await page.reload();await load(page);
  await attached(page,"owner-a");
  assert.equal(await page.evaluate(()=>window.__session.state.profile),null);
  assert.equal(await page.evaluate(()=>window.__session.serverSnapshot("owner-a","Fresh")),true);
  assert.equal(await page.evaluate(()=>window.__session.state.profile.name),"Fresh");
 }finally{await context.close();}
});
test("New tab never inherits sessionStorage authentication or private profile",{timeout:30000},async()=>{
 const context=await browser.newContext(),first=await context.newPage();
 try{
  await load(first);await first.evaluate(()=>window.__session.signIn("owner-a"));
  await first.evaluate(()=>window.__session.serverSnapshot("owner-a","Private"));
  const second=await context.newPage();await load(second);
  assert.equal(await second.evaluate(()=>window.__session.state.attached),null);
  assert.equal(await second.evaluate(()=>window.__session.state.profile),null);
 }finally{await context.close();}
});
test("Offline refresh stays private; reconnection revalidates identity before attaching",{timeout:30000},async()=>{
 const context=await browser.newContext(),page=await context.newPage();
 try{
  await load(page);await page.evaluate(()=>window.__session.signIn("owner-a"));
  await context.setOffline(true);
  await page.waitForFunction(()=>window.__session.state.events.includes("offline"));
  assert.equal(await page.evaluate(()=>window.__session.state.profile),null);
  await context.setOffline(false);
  await attached(page,"owner-a");
  assert.equal(await page.evaluate(()=>window.__session.state.profile),null);
  assert.equal(await page.evaluate(()=>window.__session.serverSnapshot("owner-a","After reconnect")),true);
 }finally{await context.close();}
});
test("Account switch and sign-out reject stale owner snapshots across reload",{timeout:30000},async()=>{
 const context=await browser.newContext(),page=await context.newPage();
 try{
  await load(page);await page.evaluate(()=>window.__session.signIn("owner-a"));
  await page.evaluate(()=>window.__session.signIn("owner-b"));
  assert.equal(await page.evaluate(()=>window.__session.serverSnapshot("owner-a","Leak")),false);
  assert.equal(await page.evaluate(()=>window.__session.serverSnapshot("owner-b","B")),true);
  await page.reload();await load(page);await attached(page,"owner-b");
  assert.equal(await page.evaluate(()=>window.__session.state.profile),null);
  await page.evaluate(()=>window.__session.signOut());
  assert.equal(await page.evaluate(()=>window.__session.serverSnapshot("owner-b","Leak")),false);
  await page.reload();await load(page);
  assert.equal(await page.evaluate(()=>window.__session.state.attached),null);
 }finally{await context.close();}
});
