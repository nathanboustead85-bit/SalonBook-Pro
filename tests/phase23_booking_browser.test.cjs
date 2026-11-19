"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),http=require("node:http"),path=require("node:path");
const {build}=require("esbuild"),{chromium}=require("playwright");
const {initializeTestEnvironment}=require("@firebase/rules-unit-testing");
const projectId="demo-boustio-phase21";
if(process.env.GCLOUD_PROJECT!==projectId||process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:9099"||process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080")throw Error("Loopback demo Firebase emulators required");
let browser,server,base,rules,bundle;
test.before(async()=>{
 const built=await build({entryPoints:[path.resolve("tests/phase23_booking_entry.mjs")],bundle:true,platform:"browser",format:"iife",write:false,logLevel:"silent"});
 bundle=built.outputFiles[0].text;
 server=http.createServer((req,res)=>{
  if(new URL(req.url,"http://localhost").pathname==="/bundle.js"){res.writeHead(200,{"content-type":"application/javascript"});res.end(bundle);return;}
  res.writeHead(200,{"content-type":"text/html"});res.end(fs.readFileSync(path.resolve("tests/fixtures/phase23_booking_preview.html"),"utf8"));
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));base="http://127.0.0.1:"+server.address().port;
 rules=await initializeTestEnvironment({projectId,firestore:{host:"127.0.0.1",port:8080,rules:fs.readFileSync("firestore.rules","utf8")}});
 browser=await chromium.launch({headless:true});
});
test.after(async()=>{await browser?.close();await rules?.cleanup();if(server)await new Promise(resolve=>server.close(resolve));});
async function page(options={}){const context=await browser.newContext(options),tab=await context.newPage();await tab.goto(base);await tab.waitForFunction(()=>Boolean(window.__phase23));return {context,tab};}
test("Premium branded page renders demo business and three services",async()=>{
 const {context,tab}=await page();try{
 assert.match(await tab.title(),/Boustio/);assert.equal(await tab.locator("[data-booking-business]").textContent(),"Kody Blends — Demo");
 assert.equal(await tab.locator(".service-choice").count(),3);
 }finally{await context.close();}
});
test("Service selection updates summary and accessible pressed state",async()=>{
 const {context,tab}=await page();try{
 await tab.locator(".service-choice").nth(1).click();
 assert.match(await tab.locator("[data-booking-summary]").textContent(),/Skin fade · £25.00 · 45 min/);
 assert.equal(await tab.locator(".service-choice").nth(1).getAttribute("aria-pressed"),"true");
 }finally{await context.close();}
});
test("No live booking, registration, payment or customer-details form exists",async()=>{
 const {context,tab}=await page();try{
 assert.equal(await tab.locator("form,input,textarea,[contenteditable],button[type=submit],a[href]").count(),0);
 assert.equal(await tab.evaluate(()=>window.__phase23.bookingsEnabled),false);
 assert.match(await tab.locator("[data-booking-status]").textContent(),/cannot be booked/);
 }finally{await context.close();}
});
test("Samsung 360px preview fits viewport and service choices have large touch targets",async()=>{
 const {context,tab}=await page({viewport:{width:360,height:740},isMobile:true,hasTouch:true});try{
 assert.equal(await tab.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const sizes=await tab.locator(".service-choice").evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height));
 assert.ok(sizes.every(n=>n>=44),JSON.stringify(sizes));
 await tab.locator(".service-choice").first().click();assert.match(await tab.locator("[data-booking-summary]").textContent(),/Haircut/);
 }finally{await context.close();}
});
test("320px mobile and 1280px desktop both avoid horizontal overflow",async()=>{
 for(const width of [320,1280]){const {context,tab}=await page({viewport:{width,height:800}});try{
 assert.equal(await tab.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }finally{await context.close();}}
});
test("Keyboard service selection remains usable",async()=>{
 const {context,tab}=await page();try{
 await tab.locator(".service-choice").last().focus();await tab.keyboard.press("Enter");
 assert.match(await tab.locator("[data-booking-summary]").textContent(),/Beard trim/);
 }finally{await context.close();}
});
test("Unauthenticated Firebase emulator cannot write private owner bookings",async()=>{
 const db=rules.unauthenticatedContext().firestore();
 await assert.rejects(db.doc("users/synthetic-owner/liveData/bookings").set({json:"[]",schemaVersion:1,updatedAt:new Date()}));
});
test("Reload clears selection and never creates a reservation",async()=>{
 const {context,tab}=await page();try{
 await tab.locator(".service-choice").first().click();await tab.reload();await tab.waitForFunction(()=>Boolean(window.__phase23));
 assert.match(await tab.locator("[data-booking-summary]").textContent(),/Select a service/);
 assert.equal(await tab.evaluate(()=>window.__phase23.bookingsEnabled),false);
 }finally{await context.close();}
});
