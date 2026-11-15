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
   assert.equal(await page.locator(".skip-link").getAttribute("href"),"#journey");
   assert.equal(await page.locator("#services").getAttribute("aria-labelledby"),"serviceHeading");
   assert.equal(await page.locator("#staff").getAttribute("aria-labelledby"),"staffHeading");
   await page.getByRole("button",{name:"Show demonstration confirmation"}).click();
   assert.match(await page.locator("#feedback").innerText(),/Choose a service/);
   assert.equal(await page.locator("#feedback").evaluate(el=>document.activeElement===el),true);
   await page.getByRole("button",{name:/Signature Haircut/}).click();
   await page.getByRole("button",{name:"Kody (demo)"}).click();
   await page.locator("#date").selectOption("2026-11-20");
   await page.getByRole("button",{name:"10:00"}).click();
   await page.getByRole("button",{name:"Show demonstration confirmation"}).click();
   assert.equal(await page.locator("#customerName").getAttribute("aria-invalid"),"true");
   await page.locator("#customerName").fill("Alex Example");
   await page.getByRole("button",{name:"Show demonstration confirmation"}).click();
   assert.equal(await page.locator("#customerEmail").getAttribute("aria-invalid"),"true");
   await page.locator("#customerEmail").fill("alex@example.com");
   await page.locator("#customerPhone").fill("07123456789");
   await page.getByRole("button",{name:"Show demonstration confirmation"}).click();
   assert.match(await page.locator("#feedback").innerText(),/consent checkbox/);
   await page.locator("#consent").check();
   await page.getByRole("button",{name:"Show demonstration confirmation"}).click();
   assert.equal(await page.locator("#confirmation").isVisible(),true);
   assert.deepEqual(errors,[]);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   console.log("PASS accessibility feedback "+width);
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
