"use strict";
// Phase 20.14: real Chromium + production session controller, isolated SDK adapter stubs.
// This does NOT validate deployed Firestore rules or real Firebase browser credentials.
const test=require("node:test"),assert=require("node:assert/strict"),http=require("node:http"),fs=require("node:fs"),path=require("node:path");
const {chromium}=require("playwright");
let server,browser,base;
test.before(async()=>{
 server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,"http://localhost").pathname;
  if(pathname==="/"){res.writeHead(200,{"content-type":"text/html"});res.end("<!doctype html><title>Phase 20.14 isolated security</title>");return;}
  if(pathname!=="/website/business/dashboard/session-integration-foundation.mjs"){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":"text/javascript"});res.end(fs.readFileSync(path.resolve(__dirname,"..","."+pathname)));
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 base="http://127.0.0.1:"+server.address().port;
 browser=await chromium.launch({headless:true});
});
test.after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
async function setup(){
 const context=await browser.newContext(),page=await context.newPage();
 await page.goto(base);
 await page.evaluate(async()=>{
  const {createDashboardSessionController}=await import("/website/business/dashboard/session-integration-foundation.mjs");
  const state={views:[],listeners:[],auth:null,token:null,claims:{email_verified:true},deny:false,delayed:false,resolveToken:null};
  const controller=createDashboardSessionController({
   onAuthStateChanged:(_auth,fn)=>{state.auth=fn;return()=>{state.auth=null;};},
   onIdTokenChanged:(_auth,fn)=>{state.token=fn;return()=>{state.token=null;};},
   onSnapshot:(uid,success,error)=>{
    const listener={uid,success,error,stopped:false};
    state.listeners.push(listener);
    return()=>{listener.stopped=true;};
   },
   doc:uid=>uid,
   getIdTokenResult:async()=>{
    if(state.delayed)return new Promise(resolve=>{state.resolveToken=resolve;});
    if(state.deny)throw Error("auth/token-expired");
    return {claims:{...state.claims}};
   },
   onView:view=>state.views.push(view)
  });
  controller.start({});
  window.__security={
   state,controller,
   signIn(uid){state.auth({uid});},
   signOut(){state.auth(null);state.token?.(null);},
   expire(){state.token?.(null);},
   listener(){return state.listeners.at(-1);},
   snapshot(uid,data,{cache=false}={}){
    const listener=state.listeners.findLast(x=>x.uid===uid);
    if(!listener)return false;
    listener.success({metadata:{fromCache:cache},exists:()=>Boolean(data),data:()=>data});
    return true;
   },
   permissionDenied(uid){
    const listener=state.listeners.findLast(x=>x.uid===uid);
    if(!listener)return false;
    listener.error({code:"permission-denied"});return true;
   },
   view(){return controller.view;}
  };
 });
 return {context,page};
}
async function view(page,status){await page.waitForFunction(s=>window.__security.view().status===s,status);}
test("Expired or revoked token fails closed and cannot display prior profile",{timeout:30000},async()=>{
 const {context,page}=await setup();
 try{
  await page.evaluate(()=>window.__security.signIn("owner-a"));await view(page,"connecting");
  await page.evaluate(()=>window.__security.snapshot("owner-a",{businessId:"owner-a",acceptingBookings:false,name:"Private"}));await view(page,"ready");
  await page.evaluate(()=>window.__security.expire());await view(page,"signed-out");
  assert.equal(await page.evaluate(()=>window.__security.view().profile),null);
  await page.evaluate(()=>{window.__security.state.deny=true;window.__security.signIn("owner-a");});
  await view(page,"invalid");
  assert.equal(await page.evaluate(()=>window.__security.view().profile),null);
 }finally{await context.close();}
});
test("Firestore permission denied clears private profile and stale callback cannot reveal cross-owner data",{timeout:30000},async()=>{
 const {context,page}=await setup();
 try{
  await page.evaluate(()=>window.__security.signIn("owner-a"));await view(page,"connecting");
  await page.evaluate(()=>window.__security.snapshot("owner-a",{businessId:"owner-a",acceptingBookings:false,name:"Old"}));await view(page,"ready");
  await page.evaluate(()=>window.__security.permissionDenied("owner-a"));await view(page,"interrupted");
  assert.equal(await page.evaluate(()=>window.__security.view().profile),null);
  await page.evaluate(()=>window.__security.signIn("owner-b"));await view(page,"connecting");
  await page.evaluate(()=>window.__security.snapshot("owner-a",{businessId:"owner-a",acceptingBookings:false,name:"Leak"}));
  assert.equal(await page.evaluate(()=>window.__security.view().profile),null);
  await page.evaluate(()=>window.__security.snapshot("owner-b",{businessId:"owner-a",acceptingBookings:false,name:"Wrong owner"}));
  await view(page,"invalid");
  assert.equal(await page.evaluate(()=>window.__security.view().profile),null);
 }finally{await context.close();}
});
test("Network interruption cache is never shown as fresh; server confirmation restores only valid owner",{timeout:30000},async()=>{
 const {context,page}=await setup();
 try{
  await page.evaluate(()=>window.__security.signIn("owner-a"));await view(page,"connecting");
  await page.evaluate(()=>window.__security.snapshot("owner-a",{businessId:"owner-a",acceptingBookings:false,name:"Cached"},{cache:true}));
  await view(page,"interrupted");
  assert.equal(await page.evaluate(()=>window.__security.view().profile),null);
  await page.evaluate(()=>window.__security.snapshot("owner-a",{businessId:"owner-a",acceptingBookings:false,name:"Fresh"}));
  await view(page,"ready");
  assert.equal(await page.evaluate(()=>window.__security.view().profile.name),"Fresh");
 }finally{await context.close();}
});
test("Sign-out during pending token validation cannot attach late identity",{timeout:30000},async()=>{
 const {context,page}=await setup();
 try{
  await page.evaluate(()=>{window.__security.state.delayed=true;window.__security.signIn("owner-a");});
  await page.waitForFunction(()=>typeof window.__security.state.resolveToken==="function");
  await page.evaluate(()=>window.__security.signOut());await view(page,"signed-out");
  await page.evaluate(()=>window.__security.state.resolveToken({claims:{email_verified:true}}));
  assert.equal(await page.evaluate(()=>window.__security.view().profile),null);
  assert.equal(await page.evaluate(()=>window.__security.state.listeners.length),0);
 }finally{await context.close();}
});
test("Unverified token and published/booking-enabled profiles are denied",{timeout:30000},async()=>{
 const {context,page}=await setup();
 try{
  await page.evaluate(()=>{window.__security.state.claims.email_verified=false;window.__security.signIn("owner-a");});
  await view(page,"unverified");
  assert.equal(await page.evaluate(()=>window.__security.state.listeners.length),0);
  await page.evaluate(()=>{window.__security.state.claims.email_verified=true;window.__security.signIn("owner-a");});
  await view(page,"connecting");
  await page.evaluate(()=>window.__security.snapshot("owner-a",{businessId:"owner-a",acceptingBookings:true,published:true}));
  await view(page,"invalid");
  assert.equal(await page.evaluate(()=>window.__security.view().profile),null);
 }finally{await context.close();}
});
