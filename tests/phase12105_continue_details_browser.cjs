"use strict";
const {chromium}=require("playwright"),assert=require("node:assert/strict");
(async()=>{const browser=await chromium.launch();try{for(const width of [360,390,768,1280]){
 const page=await browser.newPage({viewport:{width,height:850}}),errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:8765/web/phase1287/index.html");
 const next=page.locator("#continueToDetails");assert.equal(await next.isDisabled(),true);
 await page.getByRole("button",{name:/Signature Haircut/}).click();assert.equal(await next.isDisabled(),true);
 await page.getByRole("button",{name:"Kody (demo)"}).click();assert.equal(await next.isDisabled(),true);
 await page.locator("#date").selectOption("2026-11-20");assert.equal(await next.isDisabled(),true);
 await page.getByRole("button",{name:"14:00"}).click();assert.equal(await next.isEnabled(),true);
 await next.click();assert.equal(await page.evaluate(()=>document.activeElement.id),"customerName");
 await page.locator("#resetSelection").click();assert.equal(await next.isDisabled(),true);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);
 await page.close();console.log("PASS Phase 12.105 continue details viewport "+width);
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
