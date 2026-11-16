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
     staff:[{id:"a",name:"Kody",serviceIds:["cut"]},{id:"b",name:"Stylist B",serviceIds:["colour"]},{id:"c",name:"Both",serviceIds:["cut","colour"]}]}
   })}));
   await page.goto("http://127.0.0.1:8765/book/test-salon");
   const clear=page.locator("#publicClearFilters");
   await clear.waitFor({state:"attached"});
   assert.equal(await clear.isVisible(),false);
   await page.locator('.public-select[data-kind="service"][data-id="cut"]').click();
   await page.locator('.public-select[data-kind="staff"][data-id="a"]').click();
   await page.locator("#publicServiceSearch").fill("colour");
   await page.locator("#publicServiceSort").selectOption("price-desc");
   await page.locator("#publicStaffSearch").fill("both");
   await page.locator("#publicCompatibleStaffOnly").check();
   assert.equal(await clear.isVisible(),true);
   assert.equal(await page.locator('.public-select[data-kind="service"]:visible').count(),1);
   assert.equal(await page.locator('.public-select[data-kind="staff"]:visible').count(),1);
   await clear.click();
   assert.equal(await page.locator("#publicServiceSearch").inputValue(),"");
   assert.equal(await page.locator("#publicServiceSort").inputValue(),"default");
   assert.equal(await page.locator("#publicStaffSearch").inputValue(),"");
   assert.equal(await page.locator("#publicCompatibleStaffOnly").isChecked(),false);
   assert.equal(await page.locator('.public-select[data-kind="service"]:visible').count(),2);
   assert.equal(await page.locator('.public-select[data-kind="staff"]:visible').count(),3);
   assert.equal(await page.locator('.public-select[data-kind="service"][data-id="cut"]').getAttribute("aria-pressed"),"true");
   assert.equal(await page.locator('.public-select[data-kind="staff"][data-id="a"]').getAttribute("aria-pressed"),"true");
   assert.match(await page.locator("#publicSelectionSummary").innerText(),/Kody/);
   assert.equal(await clear.isVisible(),false);
   assert.equal(await page.locator("#bookingContent").isVisible(),false);
   assert.equal(writes,0);
   await page.close();
  }
  console.log("PASS Phase 13.31 clear filters, selection preservation, responsive and no writes");
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
