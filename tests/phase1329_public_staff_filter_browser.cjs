"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const {chromium}=require("playwright");
(async()=>{
 const html=fs.readFileSync(require.resolve("../website/book/index.html"),"utf8");
 const browser=await chromium.launch({headless:true});
 try {
  for (const width of [360,390,1280]) {
   const page=await browser.newPage({viewport:{width,height:844}});
   let writes=0;
   page.on("request",r=>{if(!["GET","HEAD"].includes(r.method()))writes++;});
   await page.route("**/book/test-salon",r=>r.fulfill({status:200,contentType:"text/html",body:html}));
   await page.route("**/api/public-business?business=test-salon",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
    status:"PUBLIC_PROFILE_READY",business:{slug:"test-salon",name:"Test Salon"},
    catalogue:{services:[{id:"cut",name:"Haircut",pricePence:2000,durationMinutes:30},{id:"colour",name:"Colour",pricePence:4500,durationMinutes:60}],
     staff:[{id:"a",name:"Kody",serviceIds:["cut"]},{id:"b",name:"Stylist B",serviceIds:["colour"]},{id:"c",name:"Both",serviceIds:["cut","colour"]}]}
   })}));
   await page.goto("http://127.0.0.1:8765/book/test-salon");
   const filter=page.locator("#publicCompatibleStaffOnly");
   await filter.waitFor({state:"attached"});
   assert.equal(await filter.isDisabled(),true);
   assert.equal(await page.locator('.public-select[data-kind="staff"]:visible').count(),3);
   await page.locator('.public-select[data-kind="service"][data-id="cut"]').click();
   assert.equal(await filter.isEnabled(),true);
   await filter.check();
   assert.equal(await page.locator('.public-select[data-kind="staff"]:visible').count(),2);
   assert.equal(await page.locator('.public-select[data-kind="staff"][data-id="b"]').isVisible(),false);
   assert.match(await page.locator("#publicStaffFilterStatus").innerText(),/2 professionals shown/);
   await page.locator('.public-select[data-kind="staff"][data-id="a"]').click();
   await page.locator('.public-select[data-kind="service"][data-id="colour"]').click();
   assert.equal(await filter.isChecked(),true);
   assert.equal(await page.locator('.public-select[data-kind="staff"][data-id="a"]').isVisible(),false);
   assert.equal(await page.locator('.public-select[data-kind="staff"][data-id="b"]').isVisible(),true);
   assert.match(await page.locator("#publicSelectionSummary").innerText(),/Professional: not selected/);
   await filter.uncheck();
   assert.equal(await page.locator('.public-select[data-kind="staff"]:visible').count(),3);
   await page.locator("#publicResetSelection").click();
   assert.equal(await filter.isDisabled(),true);
   assert.equal(await filter.isChecked(),false);
   assert.equal(await page.locator('.public-select[data-kind="staff"]:visible').count(),3);
   assert.equal(await page.locator("#bookingContent").isVisible(),false);
   assert.equal(writes,0);
   await page.close();
  }
  console.log("PASS Phase 13.29 staff compatibility filtering, reset, responsive widths and no writes");
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
