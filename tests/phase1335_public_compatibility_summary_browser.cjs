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
    catalogue:{services:[{id:"cut",name:"Haircut",pricePence:2000,durationMinutes:30},{id:"colour",name:"Colour",pricePence:4500,durationMinutes:60},{id:"spa",name:"Spa",pricePence:5000,durationMinutes:90}],
     staff:[{id:"a",name:"Kody",serviceIds:["cut"]},{id:"b",name:"Stylist B",serviceIds:["cut","colour"]}]}
   })}));
   await page.goto("http://127.0.0.1:8765/book/test-salon");
   const summary=page.locator("#publicCompatibilitySummary"),next=page.locator("#publicNextStep");
   await summary.waitFor();
   assert.match(await summary.innerText(),/Choose a service/);
   assert.equal(await next.isDisabled(),true);
   await page.locator('.public-select[data-kind="service"][data-id="cut"]').click();
   assert.match(await summary.innerText(),/2 professionals offer this service/);
   assert.equal(await next.isEnabled(),true);
   await page.locator('.public-select[data-kind="staff"][data-id="a"]').click();
   assert.equal(await next.isDisabled(),true);
   await page.locator('.public-select[data-kind="service"][data-id="colour"]').click();
   assert.match(await summary.innerText(),/1 professional offers this service/);
   assert.equal(await page.locator('.public-select[data-kind="staff"][data-id="a"]').getAttribute("aria-pressed"),"false");
   assert.equal(await next.isEnabled(),true);
   await page.locator('.public-select[data-kind="service"][data-id="spa"]').click();
   assert.match(await summary.innerText(),/No published professionals currently offer this service/);
   assert.equal(await next.isDisabled(),true);
   assert.equal(await page.locator('.public-select[data-kind="staff"][data-id="a"]').isDisabled(),true);
   assert.equal(await page.locator('.public-select[data-kind="staff"][data-id="b"]').isDisabled(),true);
   await page.locator("#publicResetSelection").click();
   assert.match(await summary.innerText(),/Choose a service/);
   assert.equal(await page.locator("#bookingContent").isVisible(),false);
   assert.equal(writes,0);
   await page.close();
  }
  console.log("PASS Phase 13.35 compatibility counts, zero-offer guard, selection updates and no writes");
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
