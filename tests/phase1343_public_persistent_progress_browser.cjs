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
   await page.evaluate(()=>{window.__originalProgress=document.querySelector("#livePublicCatalogue .public-progress")});
   async function check(expected){
    const result=await page.evaluate(()=>{const p=document.querySelector("#livePublicCatalogue .public-progress");return {same:p===window.__originalProgress,connected:p?.isConnected,count:document.querySelectorAll("#livePublicCatalogue .public-progress").length,text:p?.textContent,role:p?.getAttribute("role"),live:p?.getAttribute("aria-live")};});
    assert.equal(result.same,true);
    assert.equal(result.connected,true);
    assert.equal(result.count,1);
    assert.equal(result.text,expected);
    assert.equal(result.role,"status");
    assert.equal(result.live,"polite");
   }
   await check("Step 1 of 2 · Choose your service");
   await page.locator('.public-select[data-kind="service"][data-id="cut"]').click();
   await check("1 of 2 · Choose your professional");
   await page.locator('.public-select[data-kind="staff"][data-id="a"]').click();
   await check("2 of 2 · Preview selections complete");
   await page.locator("#publicChangeProfessional").click();
   await check("1 of 2 · Choose your professional");
   await page.locator("#publicResetSelection").click();
   await check("Step 1 of 2 · Choose your service");
   assert.equal(await page.locator("#bookingContent").isVisible(),false);
   assert.equal(writes,0);
   await page.close();
  }
  console.log("PASS Phase 13.43 persistent live-region identity, selection transitions and no booking writes");
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
