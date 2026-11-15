"use strict";
const {chromium}=require("playwright");
const assert=require("node:assert/strict");
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const viewport of [{width:360,height:780},{width:390,height:844},{width:412,height:915},{width:768,height:1024}]){
   const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:2});
   const page=await context.newPage();
   const errors=[],outbound=[];
   page.on("pageerror",e=>errors.push(e.message));
   page.on("request",r=>{if(!r.url().startsWith("http://127.0.0.1:8765/"))outbound.push(r.url());});
   await page.goto("http://127.0.0.1:8765/web/phase1287/index.html",{waitUntil:"networkidle"});
   await assert.doesNotReject(()=>page.getByText("Kody Blends").first().waitFor());
   assert.equal(await page.locator("#confirmation").isVisible(),false);
   assert.ok(await page.locator(".choice").count()>0);
   await page.getByRole("button",{name:/Signature Haircut/}).click();
   await page.getByRole("button",{name:"Kody (demo)"}).click();
   await page.locator("#date").selectOption("2026-11-20");
   await page.getByRole("button",{name:"10:00"}).click();
   assert.ok((await page.locator("#review").innerText()).includes("£20.00"));
   assert.ok((await page.locator("#review").innerText()).includes("10:30"));
   await page.locator("#customerName").fill("Alex Example");
   await page.locator("#customerEmail").fill("alex@example.com");
   await page.locator("#customerPhone").fill("07123456789");
   await page.getByRole("button",{name:"Show demonstration confirmation"}).click();
   assert.equal(await page.locator("#confirmation").isVisible(),false,"consent required");
   await page.locator("#consent").check();
   await page.getByRole("button",{name:"Show demonstration confirmation"}).click();
   assert.equal(await page.locator("#confirmation").isVisible(),true);
   assert.ok((await page.locator("#confirmation").innerText()).includes("NO REAL APPOINTMENT"));
   assert.ok((await page.locator("#confirmation").innerText()).includes("Alex Example"));
   assert.ok(!(await page.locator("#confirmation").innerText()).includes("alex@example.com"));
   assert.ok(!(await page.locator("#confirmation").innerText()).includes("07123456789"));
   const horizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
   assert.equal(horizontalOverflow,false,"horizontal overflow at "+viewport.width);
   assert.deepEqual(errors,[],"browser JS errors at "+viewport.width);
   assert.deepEqual(outbound,[],"unexpected external network requests at "+viewport.width);
   await context.close();
   console.log("PASS mobile viewport "+viewport.width+"x"+viewport.height);
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
