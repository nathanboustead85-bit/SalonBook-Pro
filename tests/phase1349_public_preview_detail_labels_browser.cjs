"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const {chromium}=require("playwright");
(async()=>{
 const html=fs.readFileSync(require.resolve("../website/book/index.html"),"utf8");
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [360,390,1280]){
   const page=await browser.newPage({viewport:{width,height:844}});
   let writes=0;
   page.on("request",r=>{if(!["GET","HEAD"].includes(r.method()))writes++;});
   await page.route("**/book/test-salon",r=>r.fulfill({status:200,contentType:"text/html",body:html}));
   await page.route("**/api/public-business?business=test-salon",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
    status:"PUBLIC_PROFILE_READY",business:{slug:"test-salon",name:"Test Salon"},
    catalogue:{services:[{id:"cut",name:"Haircut",pricePence:2000,durationMinutes:30},{id:"colour",name:"Colour",pricePence:4500,durationMinutes:60}],
     staff:[{id:"a",name:"Kody",serviceIds:["cut"]},{id:"b",name:"Stylist B",serviceIds:["colour"]}]}
   })}));
   await page.goto("http://127.0.0.1:8765/book/test-salon");
   const region=page.getByRole("region",{name:"Appointment preview — no booking made"});
   async function check(service,professional){
    const group=region.getByRole("group",{name:"Selected service, price and professional"});
    assert.equal(await group.count(),1);
    const cells=group.locator(".public-summary-cell");
    assert.equal(await cells.count(),3);
    const labels=await cells.evaluateAll(nodes=>nodes.map(n=>({role:n.getAttribute("role"),name:n.getAttribute("aria-label")})));
    assert.deepEqual(labels.map(x=>x.role),["group","group","group"]);
    assert.equal(labels[0].name,service?"Service: Haircut":"Service: Choose a service to explore.");
    assert.match(labels[1].name,service?/Price & duration: .*20.*30 minutes/:/Price & duration: Not selected/);
    assert.equal(labels[2].name,professional?"Professional: Professional: Kody":"Professional: Professional: not selected");
   }
   await check(false,false);
   await page.locator('.public-select[data-kind="service"][data-id="cut"]').click();
   await check(true,false);
   await page.locator('.public-select[data-kind="staff"][data-id="a"]').click();
   await check(true,true);
   await page.locator("#publicChangeProfessional").click();
   await check(true,false);
   await page.locator("#publicResetSelection").click();
   await check(false,false);
   assert.equal(await page.locator("#bookingContent").isVisible(),false);
   assert.equal(writes,0);
   await page.close();
  }
  console.log("PASS Phase 13.49 labelled appointment details across preview transitions with no booking writes");
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
