"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),http=require("node:http"),path=require("node:path");
const {build}=require("esbuild"),{chromium}=require("playwright");
const {initializeTestEnvironment}=require("@firebase/rules-unit-testing");
const projectId="demo-boustio-phase21";
if(process.env.GCLOUD_PROJECT!==projectId||process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:9099"||process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080")throw Error("Loopback demo Firebase emulators required");
let browser,server,base,rules,bundle;
test.before(async()=>{
 const built=await build({entryPoints:[path.resolve("tests/phase23_e2e_entry.mjs")],bundle:true,platform:"browser",format:"iife",write:false,logLevel:"silent"});
 bundle=built.outputFiles[0].text;
 server=http.createServer((req,res)=>{
  if(new URL(req.url,"http://localhost").pathname==="/bundle.js"){res.writeHead(200,{"content-type":"application/javascript"});res.end(bundle);return;}
  res.writeHead(200,{"content-type":"text/html"});res.end(fs.readFileSync(path.resolve("tests/fixtures/phase23_e2e_kody_blends.html"),"utf8"));
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));base="http://127.0.0.1:"+server.address().port;
 rules=await initializeTestEnvironment({projectId,firestore:{host:"127.0.0.1",port:8080,rules:fs.readFileSync("firestore.rules","utf8")}});
 browser=await chromium.launch({headless:true});
});
test.after(async()=>{await browser?.close();await rules?.cleanup();if(server)await new Promise(resolve=>server.close(resolve));});
async function page(options={}){const context=await browser.newContext(options),tab=await context.newPage();await tab.goto(base);await tab.waitForFunction(()=>Boolean(window.__phase23e2e));return {context,tab};}

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
 assert.match(await tab.locator("[data-summary]").textContent(),/Kody · Senior barber/);
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
 assert.equal(await tab.evaluate(()=>window.__phase23e2e.bookingsEnabled),false);
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
 await tab.waitForFunction(()=>Boolean(window.__phase23e2e));
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

test("Advanced month picker navigates between example months",{timeout:30000},async()=>{
 const {context,tab}=await page();try{
 assert.match(await tab.locator("[data-month]").textContent(),/November 2026/);
 assert.equal(await tab.locator("[data-month-prev]").isDisabled(),true);
 await tab.locator("[data-month-next]").click();
 assert.match(await tab.locator("[data-month]").textContent(),/December 2026/);
 assert.equal(await tab.locator("[data-days] .choice").count(),4);
 assert.equal(await tab.locator("[data-month-next]").isDisabled(),true);
 }finally{await context.close();}
});
test("Changing months clears previously selected date and time",{timeout:30000},async()=>{
 const {context,tab}=await page();try{
 await tab.locator("[data-days] .choice").first().click();
 await tab.locator("[data-times] .choice").first().click();
 await tab.locator("[data-month-next]").click();
 assert.match(await tab.locator("[data-summary]").textContent(),/Choose a date/);
 assert.match(await tab.locator("[data-summary]").textContent(),/Choose a time/);
 }finally{await context.close();}
});
test("Advanced staff cards show professional roles",{timeout:30000},async()=>{
 const {context,tab}=await page();try{
 assert.match(await tab.locator(".staff-card").first().textContent(),/Senior barber/);
 assert.match(await tab.locator(".staff-card").last().textContent(),/First available/);
 }finally{await context.close();}
});
test("Month navigation works with keyboard and booking stays disabled",{timeout:30000},async()=>{
 const {context,tab}=await page();try{
 await tab.locator("[data-month-next]").focus();await tab.keyboard.press("Enter");
 assert.match(await tab.locator("[data-month]").textContent(),/December/);
 assert.equal(await tab.locator(".fake-confirm").isDisabled(),true);
 }finally{await context.close();}
});

test("Service descriptions render in separate premium detail text",{timeout:30000},async()=>{
 const {context,tab}=await page();try{
 assert.equal(await tab.locator("[data-services] .choice-detail").count(),4);
 assert.match(await tab.locator("[data-services] .choice-detail").first().textContent(),/tailored cut/);
 }finally{await context.close();}
});
test("Professional profile bios appear with roles",{timeout:30000},async()=>{
 const {context,tab}=await page();try{
 assert.equal(await tab.locator("[data-staff] .choice-detail").count(),2);
 assert.match(await tab.locator("[data-staff] .choice-detail").first().textContent(),/Precision fades/);
 }finally{await context.close();}
});
test("Mobile step navigation fits Samsung screen",{timeout:30000},async()=>{
 const {context,tab}=await page({viewport:{width:360,height:740},isMobile:true,hasTouch:true});try{
 assert.equal(await tab.locator(".journey span").count(),4);
 assert.equal(await tab.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }finally{await context.close();}
});
test("Long service details do not expose HTML or unsafe elements",{timeout:30000},async()=>{
 const {context,tab}=await page();try{
 assert.equal(await tab.locator("[data-services] script,[data-staff] script").count(),0);
 assert.equal(await tab.locator("[data-services] img,[data-staff] img").count(),0);
 }finally{await context.close();}
});

test("Synthetic customer details are visible and noneditable",{timeout:30000},async()=>{
 const {context,tab}=await page();try{
 assert.match(await tab.locator("[data-customer]").textContent(),/Alex Example/);
 assert.match(await tab.locator("[data-customer]").textContent(),/example.invalid/);
 assert.equal(await tab.locator("input,textarea,form,[contenteditable]").count(),0);
 }finally{await context.close();}
});
test("Booking preference updates premium summary",{timeout:30000},async()=>{
 const {context,tab}=await page();try{
 await tab.locator("[data-preferences] button").nth(1).click();
 assert.match(await tab.locator("[data-customer-summary]").textContent(),/Quiet appointment/);
 assert.equal(await tab.locator("[data-preferences] button").nth(1).getAttribute("aria-pressed"),"true");
 }finally{await context.close();}
});
test("Service selection updates example total without taking payment",{timeout:30000},async()=>{
 const {context,tab}=await page();try{
 await tab.locator("[data-services] .choice").nth(1).click();
 assert.match(await tab.locator("[data-price-summary]").textContent(),/£25.00/);
 assert.equal(await tab.locator("input[type=payment],form").count(),0);
 assert.equal(await tab.locator(".fake-confirm").isDisabled(),true);
 }finally{await context.close();}
});
test("Samsung customer details and preference cards fit mobile viewport",{timeout:30000},async()=>{
 const {context,tab}=await page({viewport:{width:360,height:740},isMobile:true,hasTouch:true});try{
 assert.equal(await tab.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.equal(await tab.locator("[data-preferences] button").count(),3);
 assert.ok((await tab.locator("[data-preferences] button").evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height))).every(h=>h>=44));
 }finally{await context.close();}
});
test("Reload resets preference to synthetic default",{timeout:30000},async()=>{
 const {context,tab}=await page();try{
 await tab.locator("[data-preferences] button").last().click();
 await tab.reload();await tab.waitForFunction(()=>Boolean(window.__phase23e2e));
 assert.match(await tab.locator("[data-customer-summary]").textContent(),/No preference/);
 assert.equal(await tab.locator(".fake-confirm").isDisabled(),true);
 }finally{await context.close();}
});
test("Synthetic customer details remain local and booking remains disabled",{timeout:30000},async()=>{
 const {context,tab}=await page();try{
 const data=await tab.evaluate(()=>({customer:window.__phase23e2e.syntheticCustomer,enabled:window.__phase23e2e.bookingsEnabled}));
 assert.equal(data.customer.name,"Alex Example");assert.equal(data.enabled,false);
 const outgoing=[];tab.on("request",req=>{if(!req.url().startsWith(base))outgoing.push(req.url());});
 await tab.locator("[data-preferences] button").nth(2).click();assert.deepEqual(outgoing,[]);
 }finally{await context.close();}
});

test("Read-only appointment review opens only on explicit request",{timeout:30000},async()=>{const {context,tab}=await page();try{assert.equal(await tab.locator("[data-review-panel]").isHidden(),true);await tab.locator("[data-review-button]").click();assert.equal(await tab.locator("[data-review-panel]").isVisible(),true);assert.match(await tab.locator("[data-review-status]").textContent(),/no booking created/);}finally{await context.close();}});
test("Review lists selected service professional date time and example total",{timeout:30000},async()=>{const {context,tab}=await page();try{await tab.locator("[data-services] .choice").nth(1).click();await tab.locator("[data-staff] .choice").first().click();await tab.locator("[data-days] .choice").first().click();await tab.locator("[data-times] .choice").nth(2).click();await tab.locator("[data-review-button]").click();const details=await tab.locator("[data-review]").textContent();for(const word of ["Skin fade","Kody","Mon 23 Nov","12:00","£25.00","Alex Example"])assert.match(details,new RegExp(word));}finally{await context.close();}});
test("Review updates when example preference changes",{timeout:30000},async()=>{const {context,tab}=await page();try{await tab.locator("[data-review-button]").click();await tab.locator("[data-preferences] button").nth(1).click();assert.match(await tab.locator("[data-review]").textContent(),/Quiet appointment/);}finally{await context.close();}});
test("Review closes without changing selections",{timeout:30000},async()=>{const {context,tab}=await page();try{await tab.locator("[data-services] .choice").first().click();await tab.locator("[data-review-button]").click();await tab.locator("[data-review-button]").click();assert.equal(await tab.locator("[data-review-panel]").isHidden(),true);assert.match(await tab.locator("[data-summary]").textContent(),/Classic haircut/);}finally{await context.close();}});
test("Review works on 320px Samsung viewport with accessible button",{timeout:30000},async()=>{const {context,tab}=await page({viewport:{width:320,height:740},isMobile:true,hasTouch:true});try{await tab.locator("[data-review-button]").click();assert.equal(await tab.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.ok(await tab.locator("[data-review-button]").evaluate(el=>el.getBoundingClientRect().height>=44));}finally{await context.close();}});
test("Review never creates a confirmation or enables submission",{timeout:30000},async()=>{const {context,tab}=await page();try{const outgoing=[];tab.on("request",req=>{if(!req.url().startsWith(base))outgoing.push(req.url());});await tab.locator("[data-review-button]").click();assert.equal(await tab.locator(".fake-confirm").isDisabled(),true);assert.equal(await tab.evaluate(()=>window.__phase23e2e.bookingsEnabled),false);assert.match(await tab.locator(".demo-stamp").textContent(),/Not confirmed/);assert.deepEqual(outgoing,[]);}finally{await context.close();}});

test("Progress starts at one of four synthetic preview stages",{timeout:30000},async()=>{const {context,tab}=await page();try{assert.match(await tab.locator("[data-progress-label]").textContent(),/1 of 4/);assert.equal(await tab.locator("[data-progress]").getAttribute("max"),"4");}finally{await context.close();}});
test("Selecting service and professional advances progress",{timeout:30000},async()=>{const {context,tab}=await page();try{await tab.locator("[data-services] .choice").first().click();await tab.locator("[data-staff] .choice").first().click();assert.match(await tab.locator("[data-progress-label]").textContent(),/3 of 4/);}finally{await context.close();}});
test("Date and time complete synthetic progress",{timeout:30000},async()=>{const {context,tab}=await page();try{await tab.locator("[data-services] .choice").first().click();await tab.locator("[data-staff] .choice").first().click();await tab.locator("[data-days] .choice").first().click();await tab.locator("[data-times] .choice").first().click();assert.match(await tab.locator("[data-progress-label]").textContent(),/4 of 4/);assert.equal(await tab.locator(".journey .step-complete").count(),4);}finally{await context.close();}});
test("Changing month reduces progress and clears time",{timeout:30000},async()=>{const {context,tab}=await page();try{await tab.locator("[data-services] .choice").first().click();await tab.locator("[data-staff] .choice").first().click();await tab.locator("[data-days] .choice").first().click();await tab.locator("[data-times] .choice").first().click();await tab.locator("[data-month-next]").click();assert.match(await tab.locator("[data-progress-label]").textContent(),/3 of 4/);assert.match(await tab.locator("[data-summary]").textContent(),/Choose a time/);}finally{await context.close();}});
test("Premium review displays six distinct detail cards",{timeout:30000},async()=>{const {context,tab}=await page();try{await tab.locator("[data-review-button]").click();assert.equal(await tab.locator(".review-card").count(),6);assert.match(await tab.locator("[data-review-cards]").textContent(),/Example total/);}finally{await context.close();}});
test("Review cards update service and preference safely",{timeout:30000},async()=>{const {context,tab}=await page();try{await tab.locator("[data-review-button]").click();await tab.locator("[data-services] .choice").nth(1).click();await tab.locator("[data-preferences] button").nth(2).click();assert.match(await tab.locator("[data-review-cards]").textContent(),/Skin fade/);assert.match(await tab.locator("[data-review-cards]").textContent(),/Styling advice/);}finally{await context.close();}});
test("320px and 360px polished review fits without horizontal scrolling",{timeout:30000},async()=>{for(const width of [320,360]){const {context,tab}=await page({viewport:{width,height:740},isMobile:true,hasTouch:true});try{await tab.locator("[data-review-button]").click();assert.equal(await tab.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await tab.locator(".review-card").count(),6);}finally{await context.close();}}});
test("Progress and review remain demonstration only with no network writes",{timeout:30000},async()=>{const {context,tab}=await page();try{const external=[];tab.on("request",req=>{if(!req.url().startsWith(base))external.push(req.url());});await tab.locator("[data-services] .choice").first().click();await tab.locator("[data-review-button]").click();assert.equal(await tab.locator(".fake-confirm").isDisabled(),true);assert.equal(await tab.evaluate(()=>window.__phase23e2e.bookingsEnabled),false);assert.deepEqual(external,[]);}finally{await context.close();}});

test("Selection guidance initially prompts for service",{timeout:30000},async()=>{const {context,tab}=await page();try{assert.match(await tab.locator("[data-selection-feedback]").textContent(),/Choose a service/);assert.match(await tab.locator("[data-selection-hint]").textContent(),/4 selections remaining/);}finally{await context.close();}});
test("Service selection prompts for professional",{timeout:30000},async()=>{const {context,tab}=await page();try{await tab.locator("[data-services] .choice").first().click();assert.match(await tab.locator("[data-selection-feedback]").textContent(),/Choose a professional/);}finally{await context.close();}});
test("Date selected without time prompts for time",{timeout:30000},async()=>{const {context,tab}=await page();try{await tab.locator("[data-services] .choice").first().click();await tab.locator("[data-staff] .choice").first().click();await tab.locator("[data-days] .choice").first().click();assert.match(await tab.locator("[data-selection-feedback]").textContent(),/Choose an example time/);}finally{await context.close();}});
test("All four choices show ready to review without booking",{timeout:30000},async()=>{const {context,tab}=await page();try{await tab.locator("[data-services] .choice").first().click();await tab.locator("[data-staff] .choice").first().click();await tab.locator("[data-days] .choice").first().click();await tab.locator("[data-times] .choice").first().click();assert.match(await tab.locator("[data-selection-feedback]").textContent(),/ready to review/);assert.equal(await tab.locator(".fake-confirm").isDisabled(),true);}finally{await context.close();}});
test("Selected service has accessible selection label",{timeout:30000},async()=>{const {context,tab}=await page();try{await tab.locator("[data-services] .choice").nth(1).click();assert.match(await tab.locator("[data-services] .choice").nth(1).getAttribute("aria-label"),/selected/);assert.match(await tab.locator("[data-services] .choice").first().getAttribute("aria-label"),/choose/);}finally{await context.close();}});
test("Changing month restores example date guidance",{timeout:30000},async()=>{const {context,tab}=await page();try{await tab.locator("[data-services] .choice").first().click();await tab.locator("[data-staff] .choice").first().click();await tab.locator("[data-days] .choice").first().click();await tab.locator("[data-times] .choice").first().click();await tab.locator("[data-month-next]").click();assert.match(await tab.locator("[data-selection-feedback]").textContent(),/Choose an example date/);}finally{await context.close();}});
test("320px and 360px selection guidance avoids horizontal overflow",{timeout:30000},async()=>{for(const width of [320,360]){const {context,tab}=await page({viewport:{width,height:740},isMobile:true,hasTouch:true});try{await tab.locator("[data-services] .choice").first().click();assert.equal(await tab.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.ok(await tab.locator("[data-selection-feedback]").isVisible());}finally{await context.close();}}});
test("Selection guidance makes no external requests or real bookings",{timeout:30000},async()=>{const {context,tab}=await page();try{const outgoing=[];tab.on("request",req=>{if(!req.url().startsWith(base))outgoing.push(req.url());});await tab.locator("[data-services] .choice").first().click();await tab.locator("[data-review-button]").click();assert.equal(await tab.evaluate(()=>window.__phase23e2e.bookingsEnabled),false);assert.deepEqual(outgoing,[]);}finally{await context.close();}});

test("Keyboard arrow keys navigate service choices without selecting",{timeout:30000},async()=>{const {context,tab}=await page();try{await tab.locator("[data-services] .choice").first().focus();await tab.keyboard.press("ArrowRight");assert.equal(await tab.locator("[data-services] .choice").nth(1).evaluate(el=>document.activeElement===el),true);assert.equal(await tab.locator("[data-services] .choice").nth(1).getAttribute("aria-pressed"),"false");}finally{await context.close();}});
test("Home and End keyboard navigation reach choice boundaries",{timeout:30000},async()=>{const {context,tab}=await page();try{await tab.locator("[data-staff] .choice").first().focus();await tab.keyboard.press("End");assert.equal(await tab.locator("[data-staff] .choice").last().evaluate(el=>document.activeElement===el),true);await tab.keyboard.press("Home");assert.equal(await tab.locator("[data-staff] .choice").first().evaluate(el=>document.activeElement===el),true);}finally{await context.close();}});
test("Keyboard Enter retains focus after selection rerender",{timeout:30000},async()=>{const {context,tab}=await page();try{await tab.locator("[data-services] .choice").nth(1).focus();await tab.keyboard.press("Enter");assert.equal(await tab.locator("[data-services] .choice").nth(1).getAttribute("aria-pressed"),"true");assert.equal(await tab.locator("[data-services] .choice").nth(1).evaluate(el=>document.activeElement===el),true);}finally{await context.close();}});
test("Keyboard Space selects example time and retains focus",{timeout:30000},async()=>{const {context,tab}=await page();try{await tab.locator("[data-times] .choice").nth(2).focus();await tab.keyboard.press("Space");assert.equal(await tab.locator("[data-times] .choice").nth(2).getAttribute("aria-pressed"),"true");assert.equal(await tab.locator("[data-times] .choice").nth(2).evaluate(el=>document.activeElement===el),true);}finally{await context.close();}});
test("Review button exposes expanded state and controlled panel",{timeout:30000},async()=>{const {context,tab}=await page();try{const button=tab.locator("[data-review-button]");assert.equal(await button.getAttribute("aria-expanded"),"false");assert.equal(await button.getAttribute("aria-controls"),"appointment-review");await button.click();assert.equal(await button.getAttribute("aria-expanded"),"true");await button.click();assert.equal(await button.getAttribute("aria-expanded"),"false");}finally{await context.close();}});
test("Accessible keyboard instructions and polite selection status are present",{timeout:30000},async()=>{const {context,tab}=await page();try{assert.match(await tab.locator("[data-accessibility-help]").textContent(),/arrow keys/);assert.equal(await tab.locator(".selection-feedback").getAttribute("aria-live"),"polite");}finally{await context.close();}});
test("Samsung touch taps on 320px viewport remain large and safe",{timeout:30000},async()=>{const {context,tab}=await page({viewport:{width:320,height:740},isMobile:true,hasTouch:true});try{await tab.locator("[data-services] .choice").first().tap();await tab.locator("[data-review-button]").tap();assert.equal(await tab.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.ok(await tab.locator("[data-review-button]").evaluate(el=>el.getBoundingClientRect().height>=44));assert.equal(await tab.locator(".fake-confirm").isDisabled(),true);}finally{await context.close();}});
test("Accessibility interactions make no external requests or booking writes",{timeout:30000},async()=>{const {context,tab}=await page();try{const outgoing=[];tab.on("request",req=>{if(!req.url().startsWith(base))outgoing.push(req.url());});await tab.locator("[data-services] .choice").first().focus();await tab.keyboard.press("Enter");await tab.locator("[data-review-button]").click();assert.deepEqual(outgoing,[]);assert.equal(await tab.evaluate(()=>window.__phase23e2e.bookingsEnabled),false);}finally{await context.close();}});

test("Premium design tokens define consistent teal and spacing",{timeout:30000},async()=>{const {context,tab}=await page();try{const tokens=await tab.evaluate(()=>{const s=getComputedStyle(document.documentElement);return [s.getPropertyValue("--boustio-teal").trim(),s.getPropertyValue("--boustio-radius").trim()]});assert.deepEqual(tokens,["#087d7b","18px"]);}finally{await context.close();}});
test("Typography keeps readable base sizing and line height",{timeout:30000},async()=>{const {context,tab}=await page();try{const style=await tab.evaluate(()=>{const s=getComputedStyle(document.documentElement);return [parseFloat(s.fontSize),parseFloat(s.lineHeight)]});assert.ok(style[0]>=16);assert.ok(style[1]>=20);}finally{await context.close();}});
test("Service cards retain descriptions and premium card spacing",{timeout:30000},async()=>{const {context,tab}=await page();try{assert.equal(await tab.locator("[data-services] .service-card").count(),4);assert.equal(await tab.locator("[data-services] .choice-detail").count(),4);assert.ok(await tab.locator("[data-services] .service-card").first().evaluate(el=>el.getBoundingClientRect().height>=100));}finally{await context.close();}});
test("Summary caption changes when synthetic appointment is complete",{timeout:30000},async()=>{const {context,tab}=await page();try{assert.match(await tab.locator("[data-summary-caption]").textContent(),/Select a service/);await tab.locator("[data-services] .choice").first().click();await tab.locator("[data-staff] .choice").first().click();await tab.locator("[data-days] .choice").first().click();await tab.locator("[data-times] .choice").first().click();assert.match(await tab.locator("[data-summary-caption]").textContent(),/at a glance/);}finally{await context.close();}});
test("Summary pricing and review remain visually consistent",{timeout:30000},async()=>{const {context,tab}=await page();try{await tab.locator("[data-services] .choice").nth(1).click();await tab.locator("[data-review-button]").click();assert.match(await tab.locator("[data-price-summary]").textContent(),/£25.00/);assert.equal(await tab.locator(".review-card").count(),6);assert.ok(await tab.locator(".summary-panel").evaluate(el=>getComputedStyle(el).borderTopWidth==="4px"));}finally{await context.close();}});
test("Samsung 320px and 360px design stays within viewport",{timeout:30000},async()=>{for(const width of [320,360]){const {context,tab}=await page({viewport:{width,height:740},isMobile:true,hasTouch:true});try{await tab.locator("[data-services] .choice").first().tap();await tab.locator("[data-review-button]").tap();assert.equal(await tab.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.ok(await tab.locator("[data-services] .service-card").first().evaluate(el=>el.getBoundingClientRect().height>=44));}finally{await context.close();}}});
test("Responsive summary is not sticky on Samsung widths",{timeout:30000},async()=>{const {context,tab}=await page({viewport:{width:360,height:740},isMobile:true,hasTouch:true});try{assert.equal(await tab.locator(".summary-panel").evaluate(el=>getComputedStyle(el).position),"static");}finally{await context.close();}});
test("Premium design refinements preserve disabled booking and no external writes",{timeout:30000},async()=>{const {context,tab}=await page();try{const outgoing=[];tab.on("request",req=>{if(!req.url().startsWith(base))outgoing.push(req.url());});await tab.locator("[data-services] .choice").first().click();await tab.locator("[data-review-button]").click();assert.deepEqual(outgoing,[]);assert.equal(await tab.locator(".fake-confirm").isDisabled(),true);assert.equal(await tab.evaluate(()=>window.__phase23e2e.bookingsEnabled),false);}finally{await context.close();}});

test("Complete demo journey renders six consistent review cards",{timeout:30000},async()=>{const {context,tab}=await page();try{await tab.locator("[data-services] .choice").nth(1).click();await tab.locator("[data-staff] .choice").first().click();await tab.locator("[data-days] .choice").first().click();await tab.locator("[data-times] .choice").nth(2).click();await tab.locator("[data-review-button]").click();assert.equal(await tab.locator(".review-card").count(),6);assert.match(await tab.locator("[data-review-cards]").textContent(),/Skin fade/);assert.match(await tab.locator("[data-review-cards]").textContent(),/12:00/);assert.match(await tab.locator("[data-price-summary]").textContent(),/£25.00/);}finally{await context.close();}});
test("Changing service refreshes summary and review total",{timeout:30000},async()=>{const {context,tab}=await page();try{await tab.locator("[data-services] .choice").first().click();await tab.locator("[data-review-button]").click();await tab.locator("[data-services] .choice").nth(3).click();assert.match(await tab.locator("[data-price-summary]").textContent(),/£30.00/);assert.match(await tab.locator("[data-review-cards]").textContent(),/Cut & beard/);}finally{await context.close();}});
test("Changing professional resets example time without losing service",{timeout:30000},async()=>{const {context,tab}=await page();try{await tab.locator("[data-services] .choice").first().click();await tab.locator("[data-times] .choice").first().click();await tab.locator("[data-staff] .choice").nth(1).click();assert.equal(await tab.locator("[data-times] .choice[aria-pressed=true]").count(),0);assert.equal(await tab.locator("[data-services] .choice[aria-pressed=true]").count(),1);}finally{await context.close();}});
test("Changing month clears selected date and time",{timeout:30000},async()=>{const {context,tab}=await page();try{await tab.locator("[data-days] .choice").first().click();await tab.locator("[data-times] .choice").first().click();await tab.locator("[data-month-next]").click();assert.equal(await tab.locator("[data-days] .choice[aria-pressed=true]").count(),0);assert.equal(await tab.locator("[data-times] .choice[aria-pressed=true]").count(),0);assert.match(await tab.locator("[data-month]").textContent(),/December/);}finally{await context.close();}});
test("Changing preference is reflected in expanded review",{timeout:30000},async()=>{const {context,tab}=await page();try{await tab.locator("[data-review-button]").click();await tab.locator("[data-preferences] .choice").nth(2).click();assert.match(await tab.locator("[data-review-cards]").textContent(),/Styling advice/);}finally{await context.close();}});
test("Keyboard-only journey retains accessible review disclosure",{timeout:30000},async()=>{const {context,tab}=await page();try{await tab.locator("[data-services] .choice").first().focus();await tab.keyboard.press("Enter");await tab.locator("[data-review-button]").focus();await tab.keyboard.press("Enter");assert.equal(await tab.locator("[data-review-button]").getAttribute("aria-expanded"),"true");assert.match(await tab.locator("[data-review-status]").textContent(),/no booking created/);}finally{await context.close();}});
test("Samsung 360px touch completes example flow without horizontal overflow",{timeout:30000},async()=>{const {context,tab}=await page({viewport:{width:360,height:780},isMobile:true,hasTouch:true});try{await tab.locator("[data-services] .choice").first().tap();await tab.locator("[data-staff] .choice").first().tap();await tab.locator("[data-days] .choice").first().tap();await tab.locator("[data-times] .choice").first().tap();await tab.locator("[data-review-button]").tap();assert.equal(await tab.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await tab.locator(".review-card").count(),6);}finally{await context.close();}});
test("End-to-end demo never enables registration payments or booking",{timeout:30000},async()=>{const {context,tab}=await page();try{const outgoing=[];tab.on("request",req=>{if(!req.url().startsWith(base))outgoing.push(req.url());});await tab.locator("[data-services] .choice").first().click();await tab.locator("[data-staff] .choice").first().click();await tab.locator("[data-days] .choice").first().click();await tab.locator("[data-times] .choice").first().click();await tab.locator("[data-review-button]").click();assert.equal(await tab.locator(".fake-confirm").isDisabled(),true);assert.equal(await tab.evaluate(()=>window.__phase23e2e.bookingsEnabled),false);assert.deepEqual(outgoing,[]);}finally{await context.close();}});
