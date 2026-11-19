"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),http=require("node:http"),path=require("node:path");
const {build}=require("esbuild"),{chromium}=require("playwright");
const {initializeTestEnvironment}=require("@firebase/rules-unit-testing");
const projectId="demo-boustio-phase21";
if(process.env.GCLOUD_PROJECT!==projectId||process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:9099"||process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080")throw Error("Loopback demo Firebase emulators required");
let browser,server,base,rules,bundle;
test.before(async()=>{
 const built=await build({entryPoints:[path.resolve("tests/phase23_premium_entry.mjs")],bundle:true,platform:"browser",format:"iife",write:false,logLevel:"silent"});
 bundle=built.outputFiles[0].text;
 server=http.createServer((req,res)=>{
  if(new URL(req.url,"http://localhost").pathname==="/bundle.js"){res.writeHead(200,{"content-type":"application/javascript"});res.end(bundle);return;}
  res.writeHead(200,{"content-type":"text/html"});res.end(fs.readFileSync(path.resolve("tests/fixtures/phase23_premium_kody_blends.html"),"utf8"));
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));base="http://127.0.0.1:"+server.address().port;
 rules=await initializeTestEnvironment({projectId,firestore:{host:"127.0.0.1",port:8080,rules:fs.readFileSync("firestore.rules","utf8")}});
 browser=await chromium.launch({headless:true});
});
test.after(async()=>{await browser?.close();await rules?.cleanup();if(server)await new Promise(resolve=>server.close(resolve));});
async function page(options={}){const context=await browser.newContext(options),tab=await context.newPage();await tab.goto(base);await tab.waitForFunction(()=>Boolean(window.__phase23premium));return {context,tab};}

test("Kody Blends premium page renders four service cards",{timeout:30000},async()=>{
 const {context,tab}=await page();try{
 assert.equal(await tab.locator("[data-business]").textContent(),"Kody Blends");
 assert.equal(await tab.locator("[data-services] .choice").count(),4);
 assert.match(await tab.title(),/Kody Blends/);
 }finally{await context.close();}
});
test("Service choice updates premium booking summary",{timeout:30000},async()=>{
 const {context,tab}=await page();try{
 await tab.locator("[data-services] .choice").nth(1).click();
 assert.match(await tab.locator("[data-summary]").textContent(),/Skin fade · £25.00 · 45 min/);
 assert.equal(await tab.locator("[data-services] .choice").nth(1).getAttribute("aria-pressed"),"true");
 }finally{await context.close();}
});
test("Staff selection is reflected in summary",{timeout:30000},async()=>{
 const {context,tab}=await page();try{
 await tab.locator("[data-staff] .choice").first().click();
 assert.match(await tab.locator("[data-summary]").textContent(),/Kody/);
 }finally{await context.close();}
});
test("Example date and time selections update summary",{timeout:30000},async()=>{
 const {context,tab}=await page();try{
 await tab.locator("[data-days] .choice").first().click();
 await tab.locator("[data-times] .choice").nth(2).click();
 assert.match(await tab.locator("[data-summary]").textContent(),/Mon 23 Nov/);
 assert.match(await tab.locator("[data-summary]").textContent(),/12:00/);
 }finally{await context.close();}
});
test("Changing service resets example time selection",{timeout:30000},async()=>{
 const {context,tab}=await page();try{
 await tab.locator("[data-times] .choice").first().click();
 await tab.locator("[data-services] .choice").first().click();
 assert.match(await tab.locator("[data-summary]").textContent(),/Choose a time/);
 }finally{await context.close();}
});
test("No real booking or registration forms; confirm button remains disabled",{timeout:30000},async()=>{
 const {context,tab}=await page();try{
 assert.equal(await tab.locator("form,input,textarea,[contenteditable],a[href]").count(),0);
 assert.equal(await tab.locator(".fake-confirm").isDisabled(),true);
 assert.equal(await tab.evaluate(()=>window.__phase23premium.bookingsEnabled),false);
 assert.match(await tab.locator("[data-preview-status]").textContent(),/not live availability/);
 }finally{await context.close();}
});
test("Samsung 360px viewport avoids horizontal overflow and provides large tap targets",{timeout:30000},async()=>{
 const {context,tab}=await page({viewport:{width:360,height:740},isMobile:true,hasTouch:true});try{
 assert.equal(await tab.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const heights=await tab.locator(".choice").evaluateAll(nodes=>nodes.map(x=>x.getBoundingClientRect().height));
 assert.ok(heights.every(x=>x>=44),JSON.stringify(heights));
 }finally{await context.close();}
});
test("320px and 1280px viewports avoid horizontal overflow",{timeout:30000},async()=>{
 for(const width of [320,1280]){const {context,tab}=await page({viewport:{width,height:800}});try{
 assert.equal(await tab.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }finally{await context.close();}}
});
test("Keyboard activation works for professional choice",{timeout:30000},async()=>{
 const {context,tab}=await page();try{
 await tab.locator("[data-staff] .choice").first().focus();await tab.keyboard.press("Enter");
 assert.equal(await tab.locator("[data-staff] .choice").first().getAttribute("aria-pressed"),"true");
 }finally{await context.close();}
});
test("Unauthenticated Firebase emulator denies owner booking write",{timeout:30000},async()=>{
 const db=rules.unauthenticatedContext().firestore();
 await assert.rejects(db.doc("users/synthetic-owner/liveData/bookings").set({json:"[]",schemaVersion:1,updatedAt:new Date()}));
});
test("Reload clears synthetic selections without submitting bookings",{timeout:30000},async()=>{
 const {context,tab}=await page();try{
 await tab.locator("[data-services] .choice").first().click();await tab.reload();
 await tab.waitForFunction(()=>Boolean(window.__phase23premium));
 assert.match(await tab.locator("[data-summary]").textContent(),/Choose a service/);
 assert.equal(await tab.locator(".fake-confirm").isDisabled(),true);
 }finally{await context.close();}
});
test("No external network requests are needed for synthetic preview",{timeout:30000},async()=>{
 const {context,tab}=await page();try{
 const external=[];tab.on("request",req=>{if(!req.url().startsWith(base))external.push(req.url());});
 await tab.locator("[data-services] .choice").last().click();
 await tab.locator("[data-days] .choice").last().click();
 assert.deepEqual(external,[]);
 }finally{await context.close();}
});
