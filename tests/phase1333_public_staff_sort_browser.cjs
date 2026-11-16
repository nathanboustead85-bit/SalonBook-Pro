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
     staff:[{id:"z",name:"Zoe",serviceIds:["cut"]},{id:"a",name:"Amy",serviceIds:["cut","colour"]},{id:"b",name:"Bella",serviceIds:["colour"]},{id:"a2",name:"Amy",serviceIds:["cut"]}]}
   })}));
   await page.goto("http://127.0.0.1:8765/book/test-salon");
   const sort=page.locator("#publicStaffSort");
   await sort.waitFor();
   const order=()=>page.locator('#livePublicCatalogue .public-catalogue-grid').last().locator(".public-select").evaluateAll(nodes=>nodes.map(n=>n.dataset.id));
   assert.deepEqual(await order(),["z","a","b","a2"]);
   await sort.selectOption("name");
   assert.deepEqual(await order(),["a","a2","b","z"]);
   await sort.selectOption("name-desc");
   assert.deepEqual(await order(),["z","b","a","a2"]);
   await page.locator('.public-select[data-kind="service"][data-id="cut"]').click();
   await page.locator('.public-select[data-kind="staff"][data-id="a"]').click();
   await page.locator("#publicStaffSearch").fill("amy");
   await page.locator("#publicCompatibleStaffOnly").check();
   assert.equal(await page.locator('.public-select[data-kind="staff"]:visible').count(),2);
   assert.equal(await page.locator('.public-select[data-kind="staff"][data-id="a"]').getAttribute("aria-pressed"),"true");
   await page.locator("#publicClearFilters").click();
   assert.equal(await sort.inputValue(),"default");
   assert.deepEqual(await order(),["z","a","b","a2"]);
   assert.equal(await page.locator('.public-select[data-kind="staff"][data-id="a"]').getAttribute("aria-pressed"),"true");
   assert.equal(await page.locator("#bookingContent").isVisible(),false);
   assert.equal(writes,0);
   await page.close();
  }
  console.log("PASS Phase 13.33 professional sorting, stable ties, filters, selection, responsive and no writes");
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
