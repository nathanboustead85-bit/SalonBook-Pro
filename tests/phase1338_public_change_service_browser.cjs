"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const {chromium}=require("playwright");
(async()=>{
 const html=fs.readFileSync(require.resolve("../website/book/index.html"),"utf8");
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [360,390,1280]){
   const page=await browser.newPage({viewport:{width,height:844}});
   let writes=0;
   page.on("request",r=>{if(!["GET","HEAD"].includes(r.method()))writes++;});
   await page.route("**/book/test-salon",r=>r.fulfill({status:200,contentType:"text/html",body:html}));
   await page.route("**/api/public-business?business=test-salon",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
    status:"PUBLIC_PROFILE_READY",business:{slug:"test-salon",name:"Test Salon"},
    catalogue:{services:[{id:"cut",name:"Haircut",pricePence:2000,durationMinutes:30},{id:"colour",name:"Colour",pricePence:4500,durationMinutes:60}],
     staff:[{id:"a",name:"Kody",serviceIds:["cut"]},{id:"b",name:"Stylist B",serviceIds:["colour"]}]}
   })}));
   await page.goto("http://127.0.0.1:8765/book/test-salon");
   const change=page.locator("#publicChangeService");
   await change.waitFor({state:"attached"});
   assert.equal(await change.isVisible(),false);
   await page.locator('.public-select[data-kind="service"][data-id="cut"]').click();
   await page.locator('.public-select[data-kind="staff"][data-id="a"]').click();
   assert.equal(await change.isVisible(),true);
   await page.locator("#publicServiceSearch").fill("hair");
   await page.locator("#publicCompatibleStaffOnly").check();
   await change.click();
   assert.equal(await page.locator("#publicServiceSearch").inputValue(),"");
   assert.equal(await page.locator("#publicCompatibleStaffOnly").isChecked(),false);
   assert.equal(await page.locator('.public-select[data-kind="service"][data-id="cut"]').getAttribute("aria-pressed"),"false");
   assert.equal(await page.locator('.public-select[data-kind="staff"][data-id="a"]').getAttribute("aria-pressed"),"false");
   assert.equal(await page.locator('.public-select[data-kind="service"]:visible').count(),2);
   assert.equal(await page.locator('.public-select[data-kind="service"][data-id="cut"]').evaluate(e=>e===document.activeElement),true);
   assert.equal(await change.isVisible(),false);
   assert.match(await page.locator(".public-progress").innerText(),/Step 1 of 2/);
   await page.locator('.public-select[data-kind="service"][data-id="colour"]').click();
   assert.equal(await change.isVisible(),true);
   assert.match(await page.locator("#publicCompatibilitySummary").innerText(),/1 professional offers/);
   await page.locator('.public-select[data-kind="staff"][data-id="b"]').click();
   assert.match(await page.locator(".public-progress").innerText(),/2 of 2/);
   assert.equal(await page.locator("#bookingContent").isVisible(),false);
   assert.equal(writes,0);
   await page.close();
  }
  console.log("PASS Phase 13.38 change service, safe professional reset, focus and no writes");
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
