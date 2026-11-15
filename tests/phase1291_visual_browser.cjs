"use strict";
const {chromium}=require("playwright");
const assert=require("node:assert/strict");
(async()=>{
 const browser=await chromium.launch();
 try{
  for(const width of [360,390,412,768,1024]){
   const page=await browser.newPage({viewport:{width,height:850},isMobile:width<800,hasTouch:width<800});
   const errors=[],external=[];
   page.on("pageerror",e=>errors.push(e.message));
   page.on("request",r=>{if(!r.url().startsWith("http://127.0.0.1:8765/"))external.push(r.url());});
   await page.goto("http://127.0.0.1:8765/web/phase1287/index.html",{waitUntil:"networkidle"});
   assert.equal(await page.locator("#salonName").innerText(),"Kody Blends");
   assert.equal(await page.locator(".hero-pills span").count(),2);
   assert.equal(await page.locator(".section-kicker").count(),3);
   const heroBackground=await page.locator(".hero").evaluate(el=>getComputedStyle(el).backgroundImage);
   assert.ok(heroBackground.includes("gradient"));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,"horizontal overflow at "+width);
   if(width<=520)assert.equal(await page.locator(".hero-mark").isVisible(),false);
   else assert.equal(await page.locator(".hero-mark").isVisible(),true);
   await page.getByRole("button",{name:/Signature Haircut/}).click();
   await page.getByRole("button",{name:"Kody (demo)"}).click();
   await page.locator("#date").selectOption("2026-11-20");
   await page.getByRole("button",{name:"10:00"}).click();
   assert.match(await page.locator("#review").innerText(),/£20.00/);
   await page.locator("#customerName").fill("Demo Customer");
   await page.locator("#customerEmail").fill("demo@example.com");
   await page.locator("#customerPhone").fill("07123456789");
   await page.locator("#consent").check();
   await page.getByRole("button",{name:"Show demonstration confirmation"}).click();
   assert.equal(await page.locator("#confirmation").isVisible(),true);
   assert.match(await page.locator("#confirmation").innerText(),/NO REAL APPOINTMENT/);
   assert.deepEqual(errors,[]);
   assert.deepEqual(external,[]);
   console.log("PASS premium visual journey "+width);
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
