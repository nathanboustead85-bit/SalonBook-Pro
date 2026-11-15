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
   const readiness=page.locator("#detailsReadiness");
   assert.equal(await readiness.innerText(),"0 of 4 ready");
   await page.locator("#customerName").fill("Sample Customer");
   assert.equal(await readiness.innerText(),"1 of 4 ready");
   await page.locator("#customerEmail").fill("not-an-email");
   assert.equal(await readiness.innerText(),"1 of 4 ready");
   await page.locator("#customerEmail").fill("sample@example.test");
   assert.equal(await readiness.innerText(),"2 of 4 ready");
   await page.locator("#customerPhone").fill("07000000000");
   assert.equal(await readiness.innerText(),"3 of 4 ready");
   await page.locator("#consent").check();
   assert.equal(await readiness.innerText(),"4 of 4 ready");
   assert.equal(await page.locator("#detailsReadinessFill").evaluate(el=>el.style.width),"100%");
   await page.locator("#consent").uncheck();
   assert.equal(await readiness.innerText(),"3 of 4 ready");
   assert.equal((await readiness.innerText()).includes("Sample Customer"),false);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   assert.deepEqual(errors,[]);
   await page.close();
   console.log("PASS Phase 12.101 readiness viewport "+width);
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
