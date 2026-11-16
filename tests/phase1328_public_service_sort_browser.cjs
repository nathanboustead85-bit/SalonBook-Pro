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
    catalogue:{services:[{id:"cut",name:"Haircut",pricePence:2000,durationMinutes:30},{id:"colour",name:"Colour",pricePence:4500,durationMinutes:60},{id:"trim",name:"Beard Trim",pricePence:1000,durationMinutes:15}],
     staff:[{id:"a",name:"Kody",serviceIds:["cut","trim","colour"]}]}
   })}));
   await page.goto("http://127.0.0.1:8765/book/test-salon");
   await page.locator("#publicServiceSort").waitFor();
   const order=()=>page.locator('#livePublicCatalogue .public-catalogue-grid').first().locator(".public-select").evaluateAll(nodes=>nodes.map(n=>n.dataset.id));
   assert.deepEqual(await order(),["cut","colour","trim"]);
   await page.locator("#publicServiceSort").selectOption("price-asc");
   assert.deepEqual(await order(),["trim","cut","colour"]);
   await page.locator("#publicServiceSort").selectOption("price-desc");
   assert.deepEqual(await order(),["colour","cut","trim"]);
   await page.locator("#publicServiceSort").selectOption("duration-asc");
   assert.deepEqual(await order(),["trim","cut","colour"]);
   await page.locator("#publicServiceSort").selectOption("name");
   assert.deepEqual(await order(),["trim","colour","cut"]);
   await page.locator("#publicServiceSort").selectOption("default");
   assert.deepEqual(await order(),["cut","colour","trim"]);
   await page.locator('.public-select[data-kind="service"][data-id="colour"]').click();
   await page.locator("#publicServiceSearch").fill("beard");
   await page.locator("#publicServiceSort").selectOption("price-asc");
   assert.equal(await page.locator('.public-select[data-kind="service"]:visible').count(),1);
   assert.match(await page.locator("#publicSelectionSummary").innerText(),/Colour/);
   assert.equal(await page.locator('.public-select[data-kind="service"][data-id="colour"]').getAttribute("aria-pressed"),"true");
   assert.equal(await page.locator("#bookingContent").isVisible(),false);
   assert.equal(writes,0);
   await page.close();
  }
  console.log("PASS Phase 13.28 sort order, search compatibility, preserved selection, mobile/desktop and no writes");
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
