"use strict";const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),http=require("node:http"),path=require("node:path");
const {chromium}=require("playwright");const {initializeTestEnvironment}=require("@firebase/rules-unit-testing");const {doc,setDoc,getDoc}=require("firebase/firestore");
const projectId=process.env.GCLOUD_PROJECT||"demo-boustio-phase284";
if(projectId!=="demo-boustio-phase284"||!process.env.FIRESTORE_EMULATOR_HOST)throw Error("Phase 28.4 requires isolated demo Firestore emulator");
const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(":");let env,server,browser,base;
const data=(slug,name,price)=>({schemaVersion:1,slug,published:true,businessName:name,services:[{id:"cut",name:"Signature Haircut",pricePence:price,durationMinutes:30,published:true}],staff:[{id:"stylist",name:"Stylist",active:true,serviceIds:["cut"]}],ownerUid:"PRIVATE_OWNER",clients:[{email:"secret@example.test"}]});
test.before(async()=>{
 env=await initializeTestEnvironment({projectId,firestore:{host,port:Number(port),rules:fs.readFileSync("firestore.rules","utf8")}});
 await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();await setDoc(doc(db,"publicBusinesses","owner-a"),data("alpha-salon","Alpha Salon",2000));await setDoc(doc(db,"publicBusinesses","owner-b"),data("beta-barbers","Beta Barbers",3500));await setDoc(doc(db,"publicBusinesses","owner-c"),{...data("hidden-salon","Hidden Salon",9000),published:false});});
 server=http.createServer((req,res)=>{const url=new URL(req.url,"http://localhost");const p=url.pathname==="/preview"?"/web/phase28/emulator-preview.html":url.pathname;const allowed=/^\/web\/(?:phase(?:1280|1281|131|132|133|134|135|136)|phase28)\/[a-zA-Z0-9._-]+\.(?:js|html|css)$/.test(p);
 if(!allowed){res.writeHead(404);res.end();return;}const file=path.resolve("."+p);const type=p.endsWith(".js")?"text/javascript":p.endsWith(".css")?"text/css":"text/html";res.writeHead(200,{"content-type":type});res.end(fs.readFileSync(file));});
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));base="http://127.0.0.1:"+server.address().port;browser=await chromium.launch({headless:true});
});
test.after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await env?.cleanup();});
async function open(slug,width=390){const context=await browser.newContext({viewport:{width,height:850}});const page=await context.newPage();const mapping={"alpha-salon":"owner-a","beta-barbers":"owner-b","hidden-salon":"owner-c"};
 // The harness resolves slug via a fixed, trusted synthetic mapping. The browser
 // receives only the public document response after a real rules-enforced SDK get.
 await page.exposeFunction("phase284Lookup",async s=>mapping[s]?{slug:s,businessId:mapping[s],published:true}:null);
 await page.exposeFunction("phase284Get",async(collection,id)=>{if(collection!=="publicBusinesses")throw Error("private path");const snapshot=await getDoc(doc(env.unauthenticatedContext().firestore(),collection,id));return {exists:snapshot.exists(),data:snapshot.exists()?snapshot.data():null};});
 await page.addInitScript(()=>{window.BoustioPhase284EmulatorReader={projectId:"demo-boustio-phase284",lookup:s=>window.phase284Lookup(s),getPublicBusiness:async(c,id)=>{const r=await window.phase284Get(c,id);return {exists:()=>r.exists,data:()=>r.data};}};});
 await page.goto(base+"/preview?business="+encodeURIComponent(slug));await page.waitForFunction(()=>!document.querySelector("#stagingStatus").textContent.includes("Loading"));return {context,page};}
test("Alpha business renders real emulator-backed name, service and price",async()=>{const {context,page}=await open("alpha-salon");try{assert.equal(await page.locator("#stagingName").textContent(),"Alpha Salon");assert.match(await page.locator("#stagingServices").textContent(),/£20\.00/);}finally{await context.close();}});
test("Beta business shows its own price, not Alpha's",async()=>{const {context,page}=await open("beta-barbers");try{assert.equal(await page.locator("#stagingName").textContent(),"Beta Barbers");assert.match(await page.locator("#stagingServices").textContent(),/£35\.00/);assert.doesNotMatch(await page.locator("body").textContent(),/Alpha Salon/);}finally{await context.close();}});
test("Unpublished business fails closed",async()=>{const {context,page}=await open("hidden-salon");try{assert.equal(await page.locator("#stagingName").textContent(),"Business unavailable");assert.equal(await page.locator("#stagingServices").textContent(),"");}finally{await context.close();}});
test("Unknown slug fails closed",async()=>{const {context,page}=await open("missing-salon");try{assert.equal(await page.locator("#stagingName").textContent(),"Business unavailable");}finally{await context.close();}});
test("Private fields never rendered",async()=>{const {context,page}=await open("alpha-salon");try{assert.doesNotMatch(await page.locator("body").textContent(),/PRIVATE_OWNER|secret@example.test/);}finally{await context.close();}});
test("Booking action remains disabled",async()=>{const {context,page}=await open("alpha-salon");try{assert.equal(await page.locator("#confirm").isDisabled(),true);}finally{await context.close();}});
test("Samsung 360px layout avoids overflow",async()=>{const {context,page}=await open("alpha-salon",360);try{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}finally{await context.close();}});
test("Desktop 1280px layout avoids overflow",async()=>{const {context,page}=await open("beta-barbers",1280);try{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}finally{await context.close();}});
