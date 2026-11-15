"use strict";
const {chromium}=require("playwright"),assert=require("node:assert/strict");
(async()=>{const browser=await chromium.launch();try{for(const width of [360,390,768,1280]){
const page=await browser.newPage({viewport:{width,height:850}}),errors=[];page.on("pageerror",e=>errors.push(e.message));
await page.goto("http://127.0.0.1:8765/web/phase1287/index.html");
const status=page.locator("#selectionReadiness");
assert.equal(await status.innerText(),"0 of 4 selected");
await page.getByRole("button",{name:/Signature Haircut/}).click();assert.equal(await status.innerText(),"1 of 4 selected");
await page.getByRole("button",{name:"Kody (demo)"}).click();assert.equal(await status.innerText(),"2 of 4 selected");
await page.locator("#date").selectOption("2026-11-20");assert.equal(await status.innerText(),"3 of 4 selected");
await page.getByRole("button",{name:"14:00"}).click();assert.equal(await status.innerText(),"4 of 4 selected");
assert.equal(await page.locator("#selectionReadinessFill").evaluate(el=>el.style.width),"100%");
await page.locator("#resetSelection").click();assert.equal(await status.innerText(),"0 of 4 selected");
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);
await page.close();console.log("PASS Phase 12.103 selection progress viewport "+width);
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
