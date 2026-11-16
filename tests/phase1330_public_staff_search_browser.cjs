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
   page.on("request",r=>{if(!["GET","HEAD"].includes(r.method()))writes++;});
   await page.route("**/book/test-salon",r=>r.fulfill({status:200,contentType:"text/html",body:html}));
   await page.route("**/api/public-business?business=test-salon",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
    status:"PUBLIC_PROFILE_READY",business:{slug:"test-salon",name:"Test Salon"},
    catalogue:{services:[{id:"cut",name:"Haircut",pricePence:2000,durationMinutes:30},{id:"colour",name:"Colour",pricePence:4500,durationMinutes:60}],
    staff:[{id:"a",name:"Kody",serviceIds:["cut"]},{id:"b",name:"Stylist B",serviceIds:["colour"]},{id:"c",name:"Kody Senior",serviceIds:["cut","colour"]}]}
   })}));
   await page.goto("http://127.0.0.1:8765/book/test-salon");
   const search=page.locator("#publicStaffSearch"),filter=page.locator("#publicCompatibleStaffOnly");
   await search.waitFor();
   await search.fill("  KODY ");
   assert.equal(await page.locator('.public-select[data-kind="staff"]:visible').count(),2);
   assert.match(await page.locator("#publicStaffFilterStatus").innerText(),/2 professionals shown/);
   await page.locator('.public-select[data-kind="service"][data-id="colour"]').click();
   await filter.check();
   assert.equal(await page.locator('.public-select[data-kind="staff"]:visible').count(),1);
   assert.equal(await page.locator('.public-select[data-kind="staff"][data-id="c"]').isVisible(),true);
   await page.locator('.public-select[data-kind="staff"][data-id="c"]').click();
   await search.fill("missing name");
   assert.equal(await page.locator('.public-select[data-kind="staff"]:visible').count(),0);
   assert.match(await page.locator("#publicStaffFilterStatus").innerText(),/0 professionals shown/);
   assert.match(await page.locator("#publicSelectionSummary").innerText(),/Kody Senior/);
   await search.fill("");
   assert.equal(await page.locator('.public-select[data-kind="staff"]:visible').count(),2);
   assert.equal(await page.locator('.public-select[data-kind="staff"][data-id="c"]').getAttribute("aria-pressed"),"true");
   await page.locator("#publicResetSelection").click();
   assert.equal(await filter.isDisabled(),true);
   assert.equal(await page.locator('.public-select[data-kind="staff"]:visible').count(),3);
   assert.equal(await page.locator("#bookingContent").isVisible(),false);
   assert.equal(writes,0);
   await page.close();
  }
  console.log("PASS Phase 13.30 professional name search, compatibility, selection, responsive and no writes");
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
