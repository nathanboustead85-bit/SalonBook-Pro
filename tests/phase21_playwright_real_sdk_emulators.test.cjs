"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),http=require("node:http"),path=require("node:path");
const {build}=require("esbuild"),{chromium}=require("playwright");
const {initializeTestEnvironment}=require("@firebase/rules-unit-testing");
const {doc,setDoc}=require("firebase/firestore");
const projectId="demo-boustio-phase21";
if(process.env.GCLOUD_PROJECT!==projectId||process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:9099"||
 process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080")throw Error("Phase 21.3 requires loopback demo emulators");
let browser,server,base,rules,bundle;
async function request(endpoint,body){
 const response=await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/"+endpoint+"?key=fake-api-key",
  {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
 const result=await response.json();assert.ok(response.ok,JSON.stringify(result));return result;
}
async function owner(suffix,verify=true){
 const email="phase21-3-"+suffix+"-"+Date.now()+"@example.invalid",password="EmulatorOnly!12345";
 const user=await request("accounts:signUp",{email,password,returnSecureToken:true});
 if(verify){
  await request("accounts:sendOobCode",{requestType:"VERIFY_EMAIL",idToken:user.idToken});
  const res=await fetch("http://127.0.0.1:9099/emulator/v1/projects/"+projectId+"/oobCodes");
  assert.ok(res.ok);
  const codes=(await res.json()).oobCodes.filter(x=>x.email===email&&x.requestType==="VERIFY_EMAIL");
  assert.equal(codes.length,1);
  await request("accounts:update",{oobCode:codes[0].oobCode});
 }
 return {email,password,uid:user.localId};
}
async function seed(uid){
 await rules.withSecurityRulesDisabled(async admin=>setDoc(doc(admin.firestore(),"users",uid,"business","profile"),{
  businessId:uid,name:"Synthetic Chromium Salon",slug:"chromium-synthetic",category:"Hair",
  email:"synthetic@example.invalid",phone:"",address:"",description:"",
  acceptingBookings:false,schemaVersion:1,updatedAt:new Date()
 }));
}
async function page(){
 const context=await browser.newContext(),tab=await context.newPage();
 await tab.goto(base);await tab.waitForFunction(()=>Boolean(window.__phase21));
 return {context,tab};
}
async function status(tab,s){await tab.waitForFunction(value=>window.__phase21View?.status===value,s,{timeout:20000});}
test.before(async()=>{
 const result=await build({entryPoints:[path.resolve("tests/phase21_browser_emulator_entry.mjs")],
  bundle:true,platform:"browser",format:"iife",write:false,logLevel:"silent"});
 bundle=result.outputFiles[0].text;
 server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,"http://localhost").pathname;
  if(pathname==="/bundle.js"){res.writeHead(200,{"content-type":"application/javascript"});res.end(bundle);return;}
  res.writeHead(200,{"content-type":"text/html"});
  res.end('<!doctype html><html><body><script src="/bundle.js"></script></body></html>');
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 base="http://127.0.0.1:"+server.address().port;
 rules=await initializeTestEnvironment({projectId,firestore:{host:"127.0.0.1",port:8080,rules:fs.readFileSync("firestore.rules","utf8")}});
 browser=await chromium.launch({headless:true});
});
test.after(async()=>{await browser?.close();await rules?.cleanup();if(server)await new Promise(resolve=>server.close(resolve));});
test("Real Chromium Firebase SDK verified owner loads server profile and sign-out clears it",{timeout:45000},async()=>{
 const a=await owner("verified");await seed(a.uid);
 const {context,tab}=await page();
 try{
  await tab.evaluate(({email,password})=>window.__phase21.signIn(email,password),a);
  await status(tab,"ready");
  assert.equal(await tab.evaluate(()=>window.__phase21View.profile.businessId),a.uid);
  await tab.evaluate(()=>window.__phase21.signOut());
  await status(tab,"signed-out");
  assert.equal(await tab.evaluate(()=>window.__phase21View.profile),null);
 }finally{await context.close();}
});
test("Real Chromium Firebase SDK rejects unverified account",{timeout:45000},async()=>{
 const a=await owner("unverified",false);
 const {context,tab}=await page();
 try{
  await tab.evaluate(({email,password})=>window.__phase21.signIn(email,password),a);
  await status(tab,"unverified");
  assert.equal(await tab.evaluate(()=>window.__phase21View.profile),null);
 }finally{await context.close();}
});
test("Real Chromium Firebase SDK account switch never shows previous owner's profile",{timeout:60000},async()=>{
 const a=await owner("switch-a"),b=await owner("switch-b");await seed(a.uid);await seed(b.uid);
 const {context,tab}=await page();
 try{
  await tab.evaluate(({email,password})=>window.__phase21.signIn(email,password),a);await status(tab,"ready");
  await tab.evaluate(()=>window.__phase21.signOut());await status(tab,"signed-out");
  await tab.evaluate(({email,password})=>window.__phase21.signIn(email,password),b);
  await tab.waitForFunction(uid=>window.__phase21View.status==="ready"&&window.__phase21View.ownerUid===uid,b.uid);
  assert.equal(await tab.evaluate(()=>window.__phase21View.profile.businessId),b.uid);
 }finally{await context.close();}
});
test("Real Chromium Firebase SDK persists verified identity across reload and clears on sign-out",{timeout:60000},async()=>{
 const a=await owner("reload");await seed(a.uid);
 const {context,tab}=await page();
 try{
  await tab.evaluate(({email,password})=>window.__phase21.signIn(email,password),a);await status(tab,"ready");
  await tab.reload();await status(tab,"ready");
  assert.equal(await tab.evaluate(()=>window.__phase21View.ownerUid),a.uid);
  await tab.evaluate(()=>window.__phase21.signOut());await status(tab,"signed-out");
 }finally{await context.close();}
});
