"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),{execFileSync}=require("node:child_process"),{createRequire}=require("node:module");
// Playwright is installed under tests/node_modules in the isolated CI workflow.
const testRequire=createRequire(path.resolve(__dirname,"../tests/package.json"));
const {chromium}=testRequire("playwright");
(async()=>{
const root=path.resolve(__dirname,".."),dir=path.join(root,"preview-dist"),file=path.join(dir,"Boustio-Website-Preview.html");
execFileSync(process.execPath,[path.join(root,"scripts/build-phase28-preview.cjs")],{cwd:root,stdio:"inherit"});
const browser=await chromium.launch({headless:true});
try{
for(const [name,width,height] of [["Samsung-360",360,800],["Samsung-390",390,844],["Desktop-1280",1280,900]]){
const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:width<600,hasTouch:width<600});
try{
const page=await context.newPage();let externalRequests=0;
page.on("request",r=>{if(!r.url().startsWith("file:"))externalRequests++;});
await page.goto("file://"+file);await page.locator("#services .service-card").first().waitFor();
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,"horizontal overflow at "+width);
assert.equal(await page.locator("#confirm").isDisabled(),true);
await page.screenshot({path:path.join(dir,name+"-Landing.png"),fullPage:true});
await page.locator("#services .service-card").first().click();
await page.locator("#staff .staff-card").first().click();
await page.locator("#date").selectOption("demo-friday");
await page.locator("#times .choice").first().click();
await page.locator("#customerPreference").selectOption("quiet");
assert.equal(await page.locator("#progressTrack").getAttribute("aria-valuenow"),"4");
assert.equal(await page.locator("#confirm").isDisabled(),true);
await page.screenshot({path:path.join(dir,name+"-Review.png"),fullPage:true});
assert.equal(externalRequests,0,"offline preview must make no external requests");
console.log("PASS: "+name+" landing and selected review screenshots; no external requests or booking");
}finally{await context.close();}
}
fs.writeFileSync(path.join(dir,"README-SAMSUNG.txt"),"Boustio Phase 28.12 OFFLINE visual review\n\nOpen Boustio-Website-Preview.html on your phone using a browser or local HTML viewer. The PNG files show the exact same preview at Samsung 360px, Samsung 390px and desktop 1280px widths, both before and after sample selections.\n\nAll content is fictional; booking, payments and messaging are disabled. Do not enter real personal information. No files are deployed to a website.\n");
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
