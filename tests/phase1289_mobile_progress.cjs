"use strict";
const {chromium}=require("playwright");
const assert=require("node:assert/strict");
(async()=>{
 const browser=await chromium.launch();
 try{
  for(const width of [360,390,412]){
   const page=await browser.newPage({viewport:{width,height:800},isMobile:true,hasTouch:true});
   const errors=[];page.on("pageerror",e=>errors.push(e.message));
   await page.goto("http://127.0.0.1:8765/web/phase1287/index.html");
   const progress=page.locator("#progressMessage");
   assert.match(await progress.innerText(),/Start by choosing a service/);
   assert.equal(await page.locator('[aria-current="step"]').count(),1);
   await page.getByRole("button",{name:/Signature Haircut/}).click();
   assert.match(await progress.innerText(),/choose your professional/);
   await page.getByRole("button",{name:"Kody (demo)"}).click();
   assert.match(await progress.innerText(),/demonstration date/);
   await page.locator("#date").selectOption("2026-11-20");
   await page.getByRole("button",{name:"10:00"}).click();
   assert.match(await progress.innerText(),/Selection complete/);
   await page.getByRole("button",{name:/Beard Shape/}).click();
   assert.match(await progress.innerText(),/choose your professional/);
   assert.match(await page.locator("#review").innerText(),/Choose your service/);
   assert.equal(await page.locator("#confirmation").isVisible(),false);
   assert.equal(await page.locator('[aria-current="step"]').count(),1);
   assert.deepEqual(errors,[]);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   await page.close();
   console.log("PASS progress and reset at "+width);
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
