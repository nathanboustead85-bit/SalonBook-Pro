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
   await page.getByRole("button",{name:/Signature Haircut/}).click();
   const staff=page.locator("#staff .professional-card");
   assert.equal(await staff.count(),2);
   assert.equal(await staff.first().getAttribute("aria-label"),"Kody (demo)");
   assert.equal(await staff.first().locator(".professional-avatar").innerText(),"K");
   await page.getByRole("button",{name:"Kody (demo)"}).click();
   assert.equal(await staff.first().getAttribute("aria-pressed"),"true");
   await page.locator("#date").selectOption("2026-11-20");
   await page.getByRole("button",{name:"10:00"}).click();
   assert.match(await page.locator("#review").innerText(),/Kody/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   assert.deepEqual(errors,[]);
   await page.close();
   console.log("PASS Phase 12.97 professional cards viewport "+width);
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
