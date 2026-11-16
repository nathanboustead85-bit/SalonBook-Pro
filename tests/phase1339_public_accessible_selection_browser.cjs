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
   const cut=page.locator('.public-select[data-kind="service"][data-id="cut"]');
   const colour=page.locator('.public-select[data-kind="service"][data-id="colour"]');
   const kody=page.locator('.public-select[data-kind="staff"][data-id="a"]');
   const stylist=page.locator('.public-select[data-kind="staff"][data-id="b"]');
   assert.equal(await cut.getAttribute("aria-label"),"Select service: Haircut");
   assert.equal(await kody.getAttribute("aria-label"),"Select professional: Kody");
   await cut.click();
   assert.equal(await cut.getAttribute("aria-label"),"Selected service: Haircut");
   assert.equal(await cut.getAttribute("aria-pressed"),"true");
   assert.equal(await stylist.isDisabled(),true);
   await kody.click();
   assert.equal(await kody.getAttribute("aria-label"),"Selected professional: Kody");
   assert.equal(await kody.getAttribute("aria-pressed"),"true");
   await colour.click();
   assert.equal(await colour.getAttribute("aria-label"),"Selected service: Colour");
   assert.equal(await cut.getAttribute("aria-label"),"Select service: Haircut");
   assert.equal(await kody.getAttribute("aria-label"),"Unavailable professional: Kody — does not offer Colour");
   assert.equal(await kody.getAttribute("aria-disabled"),"true");
   assert.equal(await kody.getAttribute("aria-pressed"),"false");
   assert.equal(await stylist.isDisabled(),false);
   await page.locator("#publicResetSelection").click();
   assert.equal(await colour.getAttribute("aria-label"),"Select service: Colour");
   assert.equal(await page.locator("#bookingContent").isVisible(),false);
   assert.equal(writes,0);
   await page.close();
  }
  console.log("PASS Phase 13.39 accessible labels, selection transitions and no booking writes");
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
