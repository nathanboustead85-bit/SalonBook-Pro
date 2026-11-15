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
   await page.locator("#customerName").focus();
   await page.locator("#customerEmail").focus();
   assert.equal(await page.locator("#customerName").getAttribute("aria-invalid"),"true");
   assert.match(await page.locator("#nameHint").innerText(),/Enter a fictional name/);
   await page.locator("#customerName").fill("Sample Customer");
   assert.equal(await page.locator("#customerName").getAttribute("aria-invalid"),"false");
   assert.match(await page.locator("#nameHint").innerText(),/ready/);
   await page.locator("#customerEmail").fill("invalid");
   await page.locator("#customerPhone").focus();
   assert.equal(await page.locator("#customerEmail").getAttribute("aria-invalid"),"true");
   await page.locator("#customerEmail").fill("sample@example.test");
   assert.equal(await page.locator("#customerEmail").getAttribute("aria-invalid"),"false");
   assert.equal(await page.locator("#detailsReadiness").innerText(),"2 of 4 ready");
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   assert.deepEqual(errors,[]);
   await page.close();
   console.log("PASS Phase 12.102 guidance viewport "+width);
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
