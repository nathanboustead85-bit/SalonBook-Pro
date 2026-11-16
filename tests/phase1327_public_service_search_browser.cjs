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
    catalogue:{services:[{id:"cut",name:"Haircut",pricePence:2000,durationMinutes:30},{id:"colour",name:"Hair Colour",pricePence:4500,durationMinutes:60}],
     staff:[{id:"a",name:"Kody",serviceIds:["cut"]},{id:"b",name:"Stylist B",serviceIds:["colour"]}]}
   })}));
   await page.goto("http://127.0.0.1:8765/book/test-salon");
   await page.locator("#publicServiceSearch").waitFor();
   assert.match(await page.locator("#publicServiceSearchStatus").innerText(),/2 services/);
   await page.locator("#publicServiceSearch").fill("  COLOUR ");
   assert.match(await page.locator("#publicServiceSearchStatus").innerText(),/1 matching service/);
   assert.equal(await page.locator('.public-select[data-kind="service"][data-id="cut"]').isVisible(),false);
   assert.equal(await page.locator('.public-select[data-kind="service"][data-id="colour"]').isVisible(),true);
   await page.locator('.public-select[data-kind="service"][data-id="colour"]').click();
   await page.locator("#publicServiceSearch").fill("no match");
   assert.match(await page.locator("#publicServiceSearchStatus").innerText(),/0 matching services/);
   assert.equal(await page.locator('.public-select[data-kind="service"]:visible').count(),0);
   assert.match(await page.locator("#publicSelectionSummary").innerText(),/Hair Colour/);
   await page.locator("#publicServiceSearch").fill("");
   assert.equal(await page.locator('.public-select[data-kind="service"]:visible').count(),2);
   assert.equal(await page.locator('.public-select[data-kind="service"][data-id="colour"]').getAttribute("aria-pressed"),"true");
   assert.equal(await page.locator("#bookingContent").isVisible(),false);
   assert.equal(writes,0);
   await page.close();
  }
  console.log("PASS Phase 13.27 local service search, accessibility, selection preservation and no writes");
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
