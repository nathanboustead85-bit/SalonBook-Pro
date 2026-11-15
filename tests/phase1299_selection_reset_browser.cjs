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
   const reset=page.locator("#resetSelection");
   assert.equal(await reset.isDisabled(),true);
   await page.getByRole("button",{name:/Signature Haircut/}).click();
   await page.getByRole("button",{name:"Kody (demo)"}).click();
   await page.locator("#date").selectOption("2026-11-20");
   await page.getByRole("button",{name:"14:00"}).click();
   assert.equal(await reset.isEnabled(),true);
   assert.match(await page.locator("#review").innerText(),/14:00/);
   await reset.click();
   assert.equal(await reset.isDisabled(),true);
   assert.equal(await page.locator("#date").inputValue(),"");
   assert.equal(await page.locator("#services [aria-pressed=true]").count(),0);
   assert.equal(await page.locator("#staff .professional-card").count(),0);
   assert.match(await page.locator("#review").innerText(),/Choose your service/);
   assert.equal(await page.evaluate(()=>document.activeElement?.closest("#services")!==null),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   assert.deepEqual(errors,[]);
   await page.close();
   console.log("PASS Phase 12.99 reset viewport "+width);
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
