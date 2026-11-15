"use strict";
const {chromium}=require("playwright");
const fs=require("node:fs");
const assert=require("node:assert/strict");
const out="artifacts/phase1292-samsung-preview";
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch();
 try{
  for(const viewport of [{width:360,height:780},{width:390,height:844},{width:412,height:915},{width:768,height:1024}]){
   const page=await browser.newPage({viewport,isMobile:viewport.width<768,hasTouch:viewport.width<768,deviceScaleFactor:1});
   const errors=[],external=[];
   page.on("pageerror",e=>errors.push(e.message));
   page.on("request",r=>{if(!r.url().startsWith("http://127.0.0.1:8765/"))external.push(r.url());});
   await page.goto("http://127.0.0.1:8765/web/phase1287/index.html",{waitUntil:"networkidle"});
   assert.equal(await page.locator("#salonName").innerText(),"Kody Blends");
   assert.equal(await page.locator(".choice").count()>0,true);
   await page.screenshot({path:out+"/boustio-"+viewport.width+"-initial.png",fullPage:true});
   await page.getByRole("button",{name:/Signature Haircut/}).click();
   await page.getByRole("button",{name:"Kody (demo)"}).click();
   await page.locator("#date").selectOption("2026-11-20");
   await page.getByRole("button",{name:"10:00"}).click();
   assert.match(await page.locator("#review").innerText(),/£20.00/);
   await page.screenshot({path:out+"/boustio-"+viewport.width+"-review.png",fullPage:true});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   assert.deepEqual(errors,[]);
   assert.deepEqual(external,[]);
   await page.close();
   console.log("PASS Samsung preview capture "+viewport.width);
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
