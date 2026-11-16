"use strict";
// Phase 13.50: end-to-end read-only public catalogue release gate.
const assert=require("node:assert/strict"),fs=require("node:fs");
const {chromium}=require("playwright");
(async()=>{
 const html=fs.readFileSync(require.resolve("../website/book/index.html"),"utf8");
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [360,390,1280]){
   const page=await browser.newPage({viewport:{width,height:844}});
   const writes=[];
   page.on("request",r=>{if(!["GET","HEAD"].includes(r.method()))writes.push(r.method()+" "+r.url());});
   await page.route("**/book/test-salon",r=>r.fulfill({status:200,contentType:"text/html",body:html}));
   await page.route("**/api/public-business?business=test-salon",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
    status:"PUBLIC_PROFILE_READY",business:{slug:"test-salon",name:"Test Salon"},
    catalogue:{services:[{id:"cut",name:"Haircut",pricePence:2000,durationMinutes:30},{id:"colour",name:"Colour",pricePence:4500,durationMinutes:60}],
    staff:[{id:"a",name:"Kody",serviceIds:["cut"]},{id:"b",name:"Stylist B",serviceIds:["colour"]}]}
   })}));
   await page.goto("http://127.0.0.1:8765/book/test-salon");
   const region=page.getByRole("region",{name:"Appointment preview — no booking made"});
   const progress=region.locator(".public-progress");
   const originalProgress=await progress.elementHandle();
   async function gate(step,expected){
    assert.equal(await region.count(),1,step+" region");
    assert.equal(await region.getByRole("heading",{name:"Your appointment preview",level:2}).count(),1,step+" heading");
    assert.equal(await region.getByRole("group",{name:"Selected service, price and professional"}).count(),1,step+" details");
    assert.equal(await region.locator(".public-summary-cell[role=group]").count(),3,step+" cells");
    assert.equal(await region.getAttribute("aria-describedby"),"publicPreviewSafetyNotice",step+" safety link");
    assert.match(await region.locator("#publicPreviewSafetyNotice").innerText(),/no appointment is held or booked/,step+" warning");
    assert.equal(await progress.getAttribute("aria-live"),"polite",step+" live status");
    assert.equal(await progress.innerText(),expected,step+" progress");
    assert.equal(await progress.elementHandle()===originalProgress,true,step+" persistent status");
    assert.equal(await page.locator("#bookingContent").isVisible(),false,step+" no live booking form");
    assert.deepEqual(writes,[],step+" no write requests");
   }
   await gate("initial","Step 1 of 2 · Choose your service");
   await page.locator('.public-select[data-kind="service"][data-id="cut"]').click();
   await gate("service","1 of 2 · Choose your professional");
   assert.equal(await page.locator('.public-select[data-kind="staff"][data-id="b"]').isDisabled(),true);
   await page.locator('.public-select[data-kind="staff"][data-id="a"]').click();
   await gate("complete","2 of 2 · Preview selections complete");
   assert.match(await progress.getAttribute("aria-label"),/No appointment has been booked/);
   await page.locator("#publicChangeProfessional").click();
   await gate("change professional","1 of 2 · Choose your professional");
   await page.locator("#publicResetSelection").click();
   await gate("reset","Step 1 of 2 · Choose your service");
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,"no horizontal overflow");
   await page.close();
  }
  console.log("PASS Phase 13.50 release gate: mobile/desktop accessibility, selection, reset, compatibility and read-only safety");
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
