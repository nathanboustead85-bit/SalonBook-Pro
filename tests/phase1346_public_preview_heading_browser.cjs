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
   const region=page.getByRole("region",{name:"Appointment preview — no booking made"});
   async function check(){
    assert.equal(await region.count(),1);
    const heading=region.getByRole("heading",{name:"Your appointment preview",level:2});
    assert.equal(await heading.count(),1);
    assert.equal(await heading.getAttribute("role"),"heading");
    assert.equal(await heading.getAttribute("aria-level"),"2");
    assert.equal(await region.locator(".public-progress").count(),1);
   }
   await check();
   await page.locator('.public-select[data-kind="service"][data-id="cut"]').click();
   await check();
   await page.locator('.public-select[data-kind="staff"][data-id="a"]').click();
   await check();
   await page.locator("#publicChangeProfessional").click();
   await check();
   await page.locator("#publicResetSelection").click();
   await check();
   assert.equal(await page.locator("#bookingContent").isVisible(),false);
   assert.equal(writes,0);
   await page.close();
  }
  console.log("PASS Phase 13.46 accessible summary heading and no booking writes");
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
