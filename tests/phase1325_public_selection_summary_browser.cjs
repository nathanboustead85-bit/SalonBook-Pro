"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const {chromium}=require("playwright");
(async()=>{
 const html=fs.readFileSync(require.resolve("../website/book/index.html"),"utf8");
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  let writes=0;
  page.on("request",request=>{if(!["GET","HEAD"].includes(request.method()))writes++;});
  await page.route("**/book/test-salon",r=>r.fulfill({status:200,contentType:"text/html",body:html}));
  await page.route("**/api/public-business?business=test-salon",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
   status:"PUBLIC_PROFILE_READY",business:{slug:"test-salon",name:"Test Salon"},
   catalogue:{services:[{id:"cut",name:"Haircut",pricePence:2000,durationMinutes:30}],staff:[{id:"barber",name:"Kody",serviceIds:["cut"]}]}
  })}));
  await page.goto("http://127.0.0.1:8765/book/test-salon");
  await page.locator("#publicNextStep").waitFor();
  assert.equal(await page.locator("#publicNextStep").isDisabled(),true);
  assert.match(await page.locator(".public-progress").innerText(),/Step 1 of 2/);
  await page.locator('.public-select[data-kind="service"]').click();
  assert.equal(await page.locator("#publicNextStep").isEnabled(),true);
  assert.match(await page.locator(".public-progress").innerText(),/1 of 2/);
  assert.match(await page.locator("#publicSelectionSummary").innerText(),/£20.00 · 30 minutes/);
  await page.locator("#publicNextStep").click();
  assert.equal(await page.evaluate(()=>document.activeElement.id),"publicStaffHeading");
  await page.locator('.public-select[data-kind="staff"]').click();
  assert.equal(await page.locator("#publicNextStep").isDisabled(),true);
  assert.match(await page.locator(".public-progress").innerText(),/2 of 2/);
  assert.match(await page.locator("#publicSelectionSummary").innerText(),/Professional: Kody/);
  assert.match(await page.locator("#publicSelectionSummary").innerText(),/no appointment is held or booked/);
  assert.equal(await page.locator("#bookingContent").isVisible(),false);
  assert.equal(writes,0);
  console.log("PASS Phase 13.25 progress, summary, accessible navigation and no booking writes");
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
