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
     staff:[{id:"a",name:"Kody",serviceIds:["cut"]},{id:"b",name:"Stylist B",serviceIds:["colour"]},{id:"c",name:"Both",serviceIds:["cut","colour"]}]}
   })}));
   await page.goto("http://127.0.0.1:8765/book/test-salon");
   const matching=page.locator("#publicShowMatchingProfessionals");
   await matching.waitFor({state:"attached"});
   assert.equal(await matching.isVisible(),false);
   await page.locator('.public-select[data-kind="service"][data-id="cut"]').click();
   assert.equal(await matching.isVisible(),true);
   await page.locator('.public-select[data-kind="staff"][data-id="a"]').click();
   await page.locator("#publicStaffSearch").fill("stylist");
   assert.equal(await page.locator('.public-select[data-kind="staff"]:visible').count(),1);
   await matching.click();
   assert.equal(await page.locator("#publicStaffSearch").inputValue(),"");
   assert.equal(await page.locator("#publicCompatibleStaffOnly").isChecked(),true);
   assert.equal(await page.locator('.public-select[data-kind="staff"]:visible').count(),2);
   assert.equal(await page.locator('.public-select[data-kind="staff"][data-id="b"]').isVisible(),false);
   assert.equal(await page.locator('.public-select[data-kind="staff"][data-id="a"]').getAttribute("aria-pressed"),"true");
   assert.equal(await page.locator('.public-select[data-kind="staff"][data-id="a"]').evaluate(e=>e===document.activeElement),true);
   await page.locator('.public-select[data-kind="service"][data-id="spa"]').click();
   assert.equal(await matching.isVisible(),false);
   assert.equal(await page.locator("#publicNextStep").isDisabled(),true);
   await page.locator("#publicResetSelection").click();
   assert.equal(await matching.isVisible(),false);
   assert.equal(await page.locator("#bookingContent").isVisible(),false);
   assert.equal(writes,0);
   await page.close();
  }
  console.log("PASS Phase 13.36 matching professional shortcut, focus, no-offer guard and no writes");
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
