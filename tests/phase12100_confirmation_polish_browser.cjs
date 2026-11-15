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
   await page.getByRole("button",{name:"14:00"}).click();
   await page.locator("#customerName").fill("Sample Customer");
   await page.locator("#customerEmail").fill("sample@example.test");
   await page.locator("#customerPhone").fill("07000000000");
   await page.locator("#consent").check();
   await page.getByRole("button",{name:"Show demonstration confirmation"}).click();
   const panel=page.locator("#confirmation");
   assert.equal(await panel.isVisible(),true);
   assert.equal(await panel.locator(".confirmation-banner").count(),1);
   assert.match(await panel.innerText(),/DEMONSTRATION PREVIEW/);
   assert.match(await panel.innerText(),/No appointment has been booked/);
   assert.match(await panel.innerText(),/Sample Customer/);
   assert.match(await panel.innerText(),/Signature Haircut/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   assert.deepEqual(errors,[]);
   await page.close();
   console.log("PASS Phase 12.100 fictional confirmation viewport "+width);
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
