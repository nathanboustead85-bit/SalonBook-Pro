"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const {chromium}=require("playwright");
(async()=>{
 const html=fs.readFileSync(require.resolve("../website/book/index.html"),"utf8");
 const browser=await chromium.launch({headless:true});
 try {
  for(const width of [360,390,1280]){
   const page=await browser.newPage({viewport:{width,height:844}});
   let writes=0;
   page.on("request",request=>{if(!["GET","HEAD"].includes(request.method()))writes++;});
   await page.route("**/book/test-salon",r=>r.fulfill({status:200,contentType:"text/html",body:html}));
   await page.route("**/api/public-business?business=test-salon",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
    status:"PUBLIC_PROFILE_READY",business:{slug:"test-salon",name:"Test Salon"},
    catalogue:{services:[{id:"cut",name:"Haircut",pricePence:2000,durationMinutes:30},{id:"colour",name:"Colour",pricePence:4500,durationMinutes:60}],
     staff:[{id:"a",name:"Kody",serviceIds:["cut"]},{id:"b",name:"Stylist B",serviceIds:["colour"]}]}
   })}));
   await page.goto("http://127.0.0.1:8765/book/test-salon");
   await page.locator("#publicResetSelection").waitFor();
   assert.equal(await page.locator("#publicResetSelection").isVisible(),false);
   await page.locator('.public-select[data-kind="service"][data-id="cut"]').click();
   await page.locator('.public-select[data-kind="staff"][data-id="a"]').click();
   assert.equal(await page.locator("#publicResetSelection").isVisible(),true);
   assert.match(await page.locator(".public-progress").innerText(),/2 of 2/);
   assert.equal(await page.locator('.public-select[data-kind="staff"][data-id="b"]').isDisabled(),true);
   await page.locator("#publicResetSelection").click();
   assert.match(await page.locator(".public-progress").innerText(),/Step 1 of 2/);
   assert.equal(await page.locator("#publicResetSelection").isVisible(),false);
   assert.equal(await page.locator("#publicNextStep").isDisabled(),true);
   assert.equal(await page.locator('.public-select[data-kind="staff"][data-id="b"]').isEnabled(),true);
   assert.equal(await page.locator('.public-select[aria-pressed="true"]').count(),0);
   assert.equal(await page.evaluate(()=>document.activeElement?.dataset?.id),"cut");
   assert.match(await page.locator("#publicSelectionSummary").innerText(),/Professional: not selected/);
   assert.equal(await page.locator("#bookingContent").isVisible(),false);
   assert.equal(writes,0);
   await page.close();
  }
  console.log("PASS Phase 13.26 accessible selection reset across mobile/desktop, compatibility and no booking writes");
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
