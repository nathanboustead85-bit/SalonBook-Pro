"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const {chromium}=require("playwright");
(async()=>{
 const html=fs.readFileSync(require.resolve("../website/book/index.html"),"utf8");
 const browser=await chromium.launch({headless:true});
 try {
  for(const width of [360,390,768,1280]){
   const page=await browser.newPage({viewport:{width,height:850},deviceScaleFactor:1});
   await page.route("**/book/real-salon",r=>r.fulfill({status:200,contentType:"text/html",body:html}));
   await page.route("**/api/public-business?business=real-salon",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
    status:"PUBLIC_PROFILE_READY",business:{slug:"real-salon",name:"Real Salon",description:"Professional styling"},
    catalogue:{services:[{id:"cut",name:"Haircut",pricePence:2000,durationMinutes:30},{id:"colour",name:"Colour",pricePence:4500,durationMinutes:90}],staff:[{id:"stylist",name:"Stylist",serviceIds:["cut","colour"]}]}
   })}));
   await page.goto("http://127.0.0.1:8765/book/real-salon");
   await page.locator("#livePublicCatalogue .public-catalogue-card").first().waitFor();
   assert.equal(await page.locator("body.real-public").count(),1);
   assert.equal(await page.locator("#livePublicCatalogue .public-catalogue-card").count(),3);
   assert.equal(await page.locator("#bookingContent").isVisible(),false);
   assert.equal(await page.locator(".steps").isVisible(),false);
   assert.equal(await page.locator("#chatSend").isDisabled(),true);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
   assert.equal(overflow,false,"horizontal overflow at "+width);
   const cards=await page.locator("#livePublicCatalogue .public-catalogue-card").evaluateAll(items=>items.map(el=>({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right})));
   assert.ok(cards.every(c=>c.left>=-1&&c.right<=width+1),"cards fit at "+width);
   await page.close();
  }
  console.log("PASS Phase 13.23 responsive real business pages at 360/390/768/1280px; no booking");
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
