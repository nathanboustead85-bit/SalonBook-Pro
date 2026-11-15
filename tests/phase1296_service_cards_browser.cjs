"use strict";
const {chromium}=require("playwright");
const assert=require("node:assert/strict");
(async()=>{
 const browser=await chromium.launch();
 try{
  for(const width of [360,390,768,1280]){
   const page=await browser.newPage({viewport:{width,height:850}});
   const errors=[];page.on("pageerror",error=>errors.push(error.message));
   await page.goto("http://127.0.0.1:8765/web/phase1287/index.html");
   const cards=page.locator("#services .service-card");
   assert.equal(await cards.count(),3);
   assert.equal(await cards.first().locator(".service-card-name").innerText(),"Signature Haircut");
   assert.equal(await cards.first().locator(".service-card-price").innerText(),"£20.00");
   assert.match(await cards.first().locator(".service-card-meta").innerText(),/30/);
   await cards.first().click();
   assert.equal(await cards.first().getAttribute("aria-pressed"),"true");
   await page.getByRole("button",{name:"Kody (demo)"}).click();
   await page.locator("#date").selectOption("2026-11-20");
   await page.getByRole("button",{name:"10:00"}).click();
   assert.match(await page.locator("#review").innerText(),/£20.00/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   assert.deepEqual(errors,[]);
   await page.close();
   console.log("PASS Phase 12.96 service cards viewport "+width);
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
