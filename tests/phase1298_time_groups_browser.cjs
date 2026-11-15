"use strict";
const {chromium}=require("playwright");
const assert=require("node:assert/strict");
(async()=>{
 const browser=await chromium.launch();
 try{
  for(const width of [360,390,768,1280]){
   const page=await browser.newPage({viewport:{width,height:850}});
   const errors=[];page.on("pageerror",e=>errors.push(e.message));
   await page.goto("http://127.0.0.1:8765/web/phase1287/index.html");
   await page.getByRole("button",{name:/Signature Haircut/}).click();
   await page.getByRole("button",{name:"Kody (demo)"}).click();
   await page.locator("#date").selectOption("2026-11-20");
   assert.deepEqual(await page.locator("#times .time-period-heading").allInnerTexts(),["MORNING","AFTERNOON"]);
   assert.equal(await page.getByRole("button",{name:/11:00/}).isDisabled(),true);
   await page.getByRole("button",{name:"14:00"}).click();
   assert.match(await page.locator("#review").innerText(),/14:00/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   assert.deepEqual(errors,[]);
   await page.close();
   console.log("PASS Phase 12.98 time groups viewport "+width);
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
