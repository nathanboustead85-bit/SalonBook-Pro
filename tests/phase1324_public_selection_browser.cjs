"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const {chromium}=require("playwright");
(async()=>{
 const html=fs.readFileSync(require.resolve("../website/book/index.html"),"utf8");
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  let writes=0;
  await page.route("**/book/real-salon",r=>r.fulfill({status:200,contentType:"text/html",body:html}));
  await page.route("**/api/public-business?business=real-salon",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
   status:"PUBLIC_PROFILE_READY",business:{slug:"real-salon",name:"Real Salon"},
   catalogue:{services:[{id:"cut",name:"Haircut",pricePence:2000,durationMinutes:30},{id:"colour",name:"Colour",pricePence:5000,durationMinutes:90}],
   staff:[{id:"a",name:"Stylist A",serviceIds:["cut"]},{id:"b",name:"Stylist B",serviceIds:["colour"]}]}
  })}));
  page.on("request",r=>{if(!["GET","HEAD"].includes(r.method()))writes++;});
  await page.goto("http://127.0.0.1:8765/book/real-salon");
  const service=page.locator('.public-select[data-kind="service"]');
  const staff=page.locator('.public-select[data-kind="staff"]');
  await service.first().click();
  assert.match(await page.locator("#publicSelectionSummary").innerText(),/Haircut/);
  assert.match(await page.locator("#publicSelectionSummary").innerText(),/£20\\.00/);
  assert.equal(await staff.nth(1).isDisabled(),true);
  await staff.first().click();
  assert.match(await page.locator("#publicSelectionSummary").innerText(),/Professional: Stylist A/);
  await service.nth(1).click();
  assert.match(await page.locator("#publicSelectionSummary").innerText(),/Professional: not selected/);
  assert.equal(await staff.first().isDisabled(),true);
  await staff.nth(1).click();
  assert.match(await page.locator("#publicSelectionSummary").innerText(),/Professional: Stylist B/);
  assert.equal(await page.locator("#bookingContent").isVisible(),false);
  assert.equal(await page.locator("#chatSend").isDisabled(),true);
  assert.equal(writes,0);
  await page.reload();
  await page.locator("#publicSelectionSummary").waitFor();
  assert.match(await page.locator("#publicSelectionSummary").innerText(),/Choose a service to explore/);
  assert.equal(writes,0);
  console.log("PASS Phase 13.24 selection eligibility, reset, no persistence, no booking writes");
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
