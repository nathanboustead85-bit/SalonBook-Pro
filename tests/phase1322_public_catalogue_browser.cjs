"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {chromium}=require("playwright");
(async()=>{
 const html=fs.readFileSync(require.resolve("../website/book/index.html"),"utf8");
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  await page.route("**/book/test-salon",route=>route.fulfill({status:200,contentType:"text/html",body:html}));
  await page.route("**/api/public-business?business=test-salon",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
   status:"PUBLIC_PROFILE_READY",business:{slug:"test-salon",name:"Test Salon",description:"Welcome"},
   catalogue:{services:[{id:"cut",name:"Haircut <img src=x onerror=alert(1)>",pricePence:2000,durationMinutes:30}],
    staff:[{id:"kody",name:"Kody",serviceIds:["cut"]}]}
  })}));
  await page.goto("http://127.0.0.1:8765/book/test-salon");
  await page.locator("#livePublicCatalogue .public-catalogue-card").first().waitFor();
  assert.equal(await page.locator("#businessName").innerText(),"Test Salon");
  assert.equal(await page.locator("#livePublicCatalogue .public-catalogue-card").count(),2);
  assert.match(await page.locator("#livePublicCatalogue").innerText(),/£20\.00 · 30 minutes/);
  assert.equal(await page.locator("#livePublicCatalogue img").count(),0);
  assert.equal(await page.locator("#bookingContent").isVisible(),false);
  assert.equal(await page.locator(".disabled-action").count(),1);
  assert.equal(await page.locator("#chatSend").isDisabled(),true);
  await page.route("**/api/public-business?business=empty-salon",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({status:"PUBLIC_PROFILE_READY",business:{slug:"empty-salon",name:"Empty Salon"},catalogue:{services:[],staff:[]}})}));
  await page.route("**/book/empty-salon",route=>route.fulfill({status:200,contentType:"text/html",body:html}));
  await page.goto("http://127.0.0.1:8765/book/empty-salon");
  await page.locator("#livePublicCatalogue").waitFor();
  assert.match(await page.locator("#livePublicCatalogue").innerText(),/No services are currently listed online/);
  assert.equal(await page.locator("#bookingContent").isVisible(),false);
  console.log("PASS Phase 13.22 real-business premium cards, safe rendering, empty state and no live booking");
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
