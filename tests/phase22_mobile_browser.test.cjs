"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),http=require("node:http"),path=require("node:path");
const {build}=require("esbuild"),{chromium}=require("playwright");
const {initializeTestEnvironment}=require("@firebase/rules-unit-testing");
const {doc,setDoc}=require("firebase/firestore");
const projectId="demo-boustio-phase21";
if(process.env.GCLOUD_PROJECT!==projectId||process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:9099"||
 process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080")throw Error("Phase 21.3 requires loopback demo emulators");
let browser,server,base,rules,bundle;
async function request(endpoint,body){
 const response=await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/"+endpoint+"?key=fake-api-key",
  {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
 const result=await response.json();assert.ok(response.ok,JSON.stringify(result));return result;
}
async function owner(suffix,verify=true){
 const email="phase21-3-"+suffix+"-"+Date.now()+"@example.invalid",password="EmulatorOnly!12345";
 const user=await request("accounts:signUp",{email,password,returnSecureToken:true});
 if(verify){
  await request("accounts:sendOobCode",{requestType:"VERIFY_EMAIL",idToken:user.idToken});
  const res=await fetch("http://127.0.0.1:9099/emulator/v1/projects/"+projectId+"/oobCodes");
  assert.ok(res.ok);
  const codes=(await res.json()).oobCodes.filter(x=>x.email===email&&x.requestType==="VERIFY_EMAIL");
  assert.equal(codes.length,1);
  await request("accounts:update",{oobCode:codes[0].oobCode});
 }
 return {email,password,uid:user.localId};
}
async function seed(uid){
 await rules.withSecurityRulesDisabled(async admin=>setDoc(doc(admin.firestore(),"users",uid,"business","profile"),{
  businessId:uid,name:"Synthetic Chromium Salon",slug:"chromium-synthetic",category:"Hair",
  email:"synthetic@example.invalid",phone:"",address:"",description:"",
  acceptingBookings:false,schemaVersion:1,updatedAt:new Date()
 }));
}
async function page(){
 const context=await browser.newContext(),tab=await context.newPage();
 await tab.goto(base);await tab.waitForFunction(()=>Boolean(window.__phase22));
 return {context,tab};
}
async function status(tab,s){await tab.waitForFunction(value=>window.__phase22State?.status===value,s,{timeout:20000});}
test.before(async()=>{
 const result=await build({entryPoints:[path.resolve("tests/phase22_mobile_entry.mjs")],
  bundle:true,platform:"browser",format:"iife",write:false,logLevel:"silent"});
 bundle=result.outputFiles[0].text;
 server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,"http://localhost").pathname;
  if(pathname==="/bundle.js"){res.writeHead(200,{"content-type":"application/javascript"});res.end(bundle);return;}
  res.writeHead(200,{"content-type":"text/html"});
  res.end(fs.readFileSync(path.resolve("tests/fixtures/phase22_premium_dashboard.html"),"utf8"));
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 base="http://127.0.0.1:"+server.address().port;
 rules=await initializeTestEnvironment({projectId,firestore:{host:"127.0.0.1",port:8080,rules:fs.readFileSync("firestore.rules","utf8")}});
 browser=await chromium.launch({headless:true});
});
test.after(async()=>{await browser?.close();await rules?.cleanup();if(server)await new Promise(resolve=>server.close(resolve));});

test("Verified owner renders actual DOM from Phase 22.1 foundation",{timeout:45000},async()=>{
 const a=await owner("22-verified");await seed(a.uid);const {context,tab}=await page();
 try{
  await tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),a);await status(tab,"ready");
  assert.equal(await tab.locator("#business-name").textContent(),"Synthetic Chromium Salon");
  assert.equal(await tab.locator("#owner").textContent(),a.uid);
  assert.equal(await tab.locator("#booking").textContent(),"Customer bookings disabled");
  assert.equal(await tab.evaluate(()=>window.__phase22State.bookingsEnabled),false);
 }finally{await context.close();}
});
test("Unverified owner cannot render private business DOM",{timeout:45000},async()=>{
 const a=await owner("22-unverified",false);const {context,tab}=await page();
 try{
  await tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),a);await status(tab,"unverified");
  assert.equal(await tab.locator("#business-name").textContent(),"");
  assert.equal(await tab.locator("#owner").textContent(),"");
 }finally{await context.close();}
});
test("Sign-out clears previously rendered business details",{timeout:45000},async()=>{
 const a=await owner("22-signout");await seed(a.uid);const {context,tab}=await page();
 try{
  await tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),a);await status(tab,"ready");
  await tab.evaluate(()=>window.__phase22.signOut());await status(tab,"signed-out");
  assert.equal(await tab.locator("#business-name").textContent(),"");
  assert.equal(await tab.locator("#owner").textContent(),"");
 }finally{await context.close();}
});
test("Independent browser contexts cannot display other owner's business",{timeout:65000},async()=>{
 const a=await owner("22-isolate-a"),b=await owner("22-isolate-b");await seed(a.uid);await seed(b.uid);
 const first=await page(),second=await page();
 try{
  await Promise.all([first.tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),a),
   second.tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),b)]);
  await Promise.all([status(first.tab,"ready"),status(second.tab,"ready")]);
  assert.equal(await first.tab.locator("#owner").textContent(),a.uid);
  assert.equal(await second.tab.locator("#owner").textContent(),b.uid);
  await first.tab.evaluate(()=>window.__phase22.signOut());await status(first.tab,"signed-out");
  assert.equal(await second.tab.locator("#owner").textContent(),b.uid);
 }finally{await first.context.close();await second.context.close();}
});
test("Browser reload restores verified owner without enabling bookings",{timeout:60000},async()=>{
 const a=await owner("22-reload");await seed(a.uid);const {context,tab}=await page();
 try{
  await tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),a);await status(tab,"ready");
  await tab.reload();await status(tab,"ready");
  assert.equal(await tab.locator("#owner").textContent(),a.uid);
  assert.equal(await tab.evaluate(()=>window.__phase22State.registrationEnabled),false);
 }finally{await context.close();}
});

test("Secure interface hides private panel for unverified owner and reveals only after verified profile",{timeout:45000},async()=>{
 const a=await owner("23-panel");await seed(a.uid);const {context,tab}=await page();
 try{
  assert.equal(await tab.locator("#private-panel").isHidden(),true);
  await tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),a);await status(tab,"ready");
  assert.equal(await tab.locator("#private-panel").isVisible(),true);
  await tab.evaluate(()=>window.__phase22.signOut());await status(tab,"signed-out");
  assert.equal(await tab.locator("#private-panel").isHidden(),true);
  assert.equal(await tab.locator("#business-name").textContent(),"");
 }finally{await context.close();}
});
test("Secure renderer displays synthetic HTML payload as text, never executable markup",{timeout:45000},async()=>{
 const a=await owner("23-xss");await seed(a.uid);
 await rules.withSecurityRulesDisabled(async admin=>setDoc(doc(admin.firestore(),"users",a.uid,"business","profile"),{
  businessId:a.uid,name:'<img src=x onerror="window.__xss=true">',category:"Hair",
  acceptingBookings:false,schemaVersion:1,updatedAt:new Date()
 }));
 const {context,tab}=await page();
 try{
  await tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),a);await status(tab,"ready");
  assert.equal(await tab.locator("#business-name").textContent(),'<img src=x onerror="window.__xss=true">');
  assert.equal(await tab.locator("#business-name img").count(),0);
  assert.equal(await tab.evaluate(()=>Boolean(window.__xss)),false);
 }finally{await context.close();}
});

test("Premium teal-and-white dashboard has clear preview identity and disabled feature labels",{timeout:45000},async()=>{
 const {context,tab}=await page();
 try{
  assert.match(await tab.title(),/Boustio/);
  assert.equal(await tab.locator(".brand").textContent(),"☁boustio");
  assert.match(await tab.locator("header").evaluate(el=>getComputedStyle(el).backgroundColor),/rgb\(8, 125, 123\)/);
  assert.match(await tab.locator(".warning").textContent(),/not the live dashboard/);
  assert.equal(await tab.locator("#booking").textContent(),"Customer bookings disabled");
  assert.equal(await tab.locator("#registration").textContent(),"Public registration disabled");
  assert.equal(await tab.locator("#private-panel").isHidden(),true);
 }finally{await context.close();}
});
test("Mobile-width premium dashboard fits viewport and preserves private-panel security",{timeout:45000},async()=>{
 const a=await owner("24-mobile");await seed(a.uid);
 const context=await browser.newContext({viewport:{width:390,height:844}}),tab=await context.newPage();
 try{
  await tab.goto(base);await tab.waitForFunction(()=>Boolean(window.__phase22));
  assert.equal(await tab.locator("#private-panel").isHidden(),true);
  await tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),a);await status(tab,"ready");
  assert.equal(await tab.locator("#private-panel").isVisible(),true);
  assert.equal(await tab.locator("#owner").textContent(),a.uid);
  assert.equal(await tab.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 }finally{await context.close();}
});
test("Dashboard presentation has no live account registration, booking or publishing controls",{timeout:45000},async()=>{
 const {context,tab}=await page();
 try{
  assert.equal(await tab.locator("form, input, [contenteditable], a[href]").count(),0);
  assert.equal(await tab.locator("button[data-nav-target]").count(),4);
  assert.equal(await tab.locator("script[src]").count(),1);
  assert.equal(await tab.locator("script[src]").getAttribute("src"),"/bundle.js");
 }finally{await context.close();}
});

test("Four dashboard tabs navigate with only one visible section and correct accessibility state",{timeout:45000},async()=>{
 const {context,tab}=await page();
 try{
  for(const id of ["services","staff","settings","overview"]){
   await tab.locator('[data-nav-target="'+id+'"]').click();
   assert.equal(await tab.locator('[data-nav-panel="'+id+'"]').isVisible(),true);
   assert.equal(await tab.locator('[data-nav-panel]:visible').count(),1);
   assert.equal(await tab.locator('[data-nav-target="'+id+'"]').getAttribute("aria-current"),"page");
   assert.equal(await tab.evaluate(()=>window.__phase22.activeSection()),id);
  }
  assert.equal(await tab.locator("#private-panel").isHidden(),true);
 }finally{await context.close();}
});
test("Keyboard-operated dashboard navigation works without enabling edit or booking controls",{timeout:45000},async()=>{
 const {context,tab}=await page();
 try{
  await tab.locator('[data-nav-target="services"]').focus();
  await tab.keyboard.press("Enter");
  assert.equal(await tab.locator('[data-nav-panel="services"]').isVisible(),true);
  await tab.locator('[data-nav-target="settings"]').focus();
  await tab.keyboard.press("Space");
  assert.equal(await tab.locator('[data-nav-panel="settings"]').isVisible(),true);
  assert.equal(await tab.locator("form, input, [contenteditable], a[href]").count(),0);
 }finally{await context.close();}
});
test("Sign-out resets navigation and hides owner details after viewing settings",{timeout:45000},async()=>{
 const a=await owner("25-reset");await seed(a.uid);const {context,tab}=await page();
 try{
  await tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),a);await status(tab,"ready");
  await tab.locator('[data-nav-target="settings"]').click();
  assert.equal(await tab.evaluate(()=>window.__phase22.activeSection()),"settings");
  await tab.evaluate(()=>window.__phase22.signOut());await status(tab,"signed-out");
  assert.equal(await tab.evaluate(()=>window.__phase22.activeSection()),"overview");
  assert.equal(await tab.locator("#private-panel").isHidden(),true);
  assert.equal(await tab.locator("#owner").textContent(),"");
 }finally{await context.close();}
});
test("Mobile dashboard tabs are usable without page-wide horizontal overflow",{timeout:45000},async()=>{
 const context=await browser.newContext({viewport:{width:360,height:740}}),tab=await context.newPage();
 try{
  await tab.goto(base);await tab.waitForFunction(()=>Boolean(window.__phase22));
  await tab.locator('[data-nav-target="staff"]').click();
  assert.equal(await tab.locator('[data-nav-panel="staff"]').isVisible(),true);
  await tab.locator('[data-nav-target="settings"]').click();
  assert.equal(await tab.locator('[data-nav-panel="settings"]').isVisible(),true);
  assert.equal(await tab.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }finally{await context.close();}
});
test("Reload resets preview navigation and restores authenticated owner safely",{timeout:60000},async()=>{
 const a=await owner("25-reload");await seed(a.uid);const {context,tab}=await page();
 try{
  await tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),a);await status(tab,"ready");
  await tab.locator('[data-nav-target="staff"]').click();
  await tab.reload();await status(tab,"ready");
  assert.equal(await tab.evaluate(()=>window.__phase22.activeSection()),"overview");
  assert.equal(await tab.locator("#owner").textContent(),a.uid);
  assert.equal(await tab.locator("#booking").textContent(),"Customer bookings disabled");
 }finally{await context.close();}
});

async function seedSummary(uid,type,items){
 await rules.withSecurityRulesDisabled(async admin=>setDoc(doc(admin.firestore(),"users",uid,"liveData",type),{
  json:JSON.stringify(items),schemaVersion:1,updatedAt:new Date()
 }));
}
test("Verified owner sees read-only service and staff names from Firestore",{timeout:45000},async()=>{
 const a=await owner("26-data");await seed(a.uid);
 await seedSummary(a.uid,"services",[{name:"Haircut"},{name:"Beard trim"}]);
 await seedSummary(a.uid,"staff",[{name:"Synthetic Barber"}]);
 const {context,tab}=await page();
 try{
  await tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),a);await status(tab,"ready");
  await tab.waitForFunction(()=>document.querySelector('[data-summary="service-summary"]').textContent==="2 services"&&document.querySelector('[data-summary="staff-summary"]').textContent==="1 staff member");
  await tab.locator('[data-nav-target="services"]').click();
  assert.deepEqual(await tab.locator('[data-summary="service-items"] li').allTextContents(),["Haircut","Beard trim"]);
  await tab.locator('[data-nav-target="staff"]').click();
  assert.deepEqual(await tab.locator('[data-summary="staff-items"] li').allTextContents(),["Synthetic Barber"]);
 }finally{await context.close();}
});
test("Unverified owner cannot read or display service or staff summaries",{timeout:45000},async()=>{
 const a=await owner("26-unverified",false);await seed(a.uid);
 await seedSummary(a.uid,"services",[{name:"Private Service"}]);
 const {context,tab}=await page();
 try{
  await tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),a);await status(tab,"unverified");
  assert.equal(await tab.locator('[data-summary="service-items"] li').count(),0);
  assert.equal(await tab.locator('[data-summary="staff-items"] li').count(),0);
 }finally{await context.close();}
});
test("Sign-out immediately removes owner-scoped service and staff summaries",{timeout:45000},async()=>{
 const a=await owner("26-signout");await seed(a.uid);
 await seedSummary(a.uid,"services",[{name:"Private Service"}]);
 const {context,tab}=await page();
 try{
  await tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),a);await status(tab,"ready");
  await tab.waitForFunction(()=>document.querySelector('[data-summary="service-summary"]').textContent==="1 service");
  await tab.evaluate(()=>window.__phase22.signOut());await status(tab,"signed-out");
  assert.equal(await tab.locator('[data-summary="service-items"] li').count(),0);
  assert.equal(await tab.locator('[data-summary="staff-items"] li').count(),0);
 }finally{await context.close();}
});
test("Different browser owners never display each other's service summaries",{timeout:65000},async()=>{
 const a=await owner("26-a"),b=await owner("26-b");await seed(a.uid);await seed(b.uid);
 await seedSummary(a.uid,"services",[{name:"Owner A haircut"}]);
 await seedSummary(b.uid,"services",[{name:"Owner B nails"}]);
 const first=await page(),second=await page();
 try{
  await Promise.all([first.tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),a),second.tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),b)]);
  await Promise.all([status(first.tab,"ready"),status(second.tab,"ready")]);
  await first.tab.waitForFunction(()=>document.querySelector('[data-summary="service-items"]').textContent.includes("Owner A haircut"));
  await second.tab.waitForFunction(()=>document.querySelector('[data-summary="service-items"]').textContent.includes("Owner B nails"));
  assert.equal((await first.tab.locator('[data-summary="service-items"]').textContent()).includes("Owner B nails"),false);
  assert.equal((await second.tab.locator('[data-summary="service-items"]').textContent()).includes("Owner A haircut"),false);
 }finally{await first.context.close();await second.context.close();}
});
test("Service names with HTML markup are rendered only as inert text",{timeout:45000},async()=>{
 const a=await owner("26-xss");await seed(a.uid);
 await seedSummary(a.uid,"services",[{name:'<img src=x onerror="window.__summaryXss=true">'}]);
 const {context,tab}=await page();
 try{
  await tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),a);await status(tab,"ready");
  await tab.waitForFunction(()=>document.querySelector('[data-summary="service-items"] li')?.textContent.includes("<img"));
  assert.equal(await tab.locator('[data-summary="service-items"] img').count(),0);
  assert.equal(await tab.evaluate(()=>Boolean(window.__summaryXss)),false);
 }finally{await context.close();}
});

test("Read-only management cards show service prices, durations and staff roles",{timeout:45000},async()=>{
 const a=await owner("27-details");await seed(a.uid);
 await seedSummary(a.uid,"services",[{name:"Cut and finish",price:25.5,duration:45},{name:"Beard",price:12,duration:20}]);
 await seedSummary(a.uid,"staff",[{name:"Alex",role:"Senior stylist"}]);
 const {context,tab}=await page();
 try{
  await tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),a);await status(tab,"ready");
  await tab.waitForFunction(()=>document.querySelector('[data-summary="service-items"] li small')?.textContent.includes("£25.50"));
  await tab.locator('[data-nav-target="services"]').click();
  assert.deepEqual(await tab.locator('[data-summary="service-items"] li small').allTextContents(),["£25.50 · 45 min","£12.00 · 20 min"]);
  await tab.locator('[data-nav-target="staff"]').click();
  assert.equal(await tab.locator('[data-summary="staff-items"] li small').textContent(),"Senior stylist");
 }finally{await context.close();}
});
test("Invalid price and duration values are not presented as legitimate business prices",{timeout:45000},async()=>{
 const a=await owner("27-invalid");await seed(a.uid);
 await seedSummary(a.uid,"services",[{name:"Invalid",price:-999,duration:-45},{name:"Invalid two",price:"99",duration:"30"}]);
 const {context,tab}=await page();
 try{
  await tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),a);await status(tab,"ready");
  await tab.waitForFunction(()=>document.querySelector('[data-summary="service-summary"]').textContent==="2 services");
  assert.equal(await tab.locator('[data-summary="service-items"] small').count(),0);
 }finally{await context.close();}
});
test("Management metadata HTML injection remains inert text",{timeout:45000},async()=>{
 const a=await owner("27-xss");await seed(a.uid);
 await seedSummary(a.uid,"staff",[{name:"Alex",role:'<img src=x onerror="window.__roleXss=true">'}]);
 const {context,tab}=await page();
 try{
  await tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),a);await status(tab,"ready");
  await tab.waitForFunction(()=>document.querySelector('[data-summary="staff-items"] small')?.textContent.includes("<img"));
  assert.equal(await tab.locator('[data-summary="staff-items"] img').count(),0);
  assert.equal(await tab.evaluate(()=>Boolean(window.__roleXss)),false);
 }finally{await context.close();}
});
test("Read-only management cards clear after sign-out even after viewing staff",{timeout:45000},async()=>{
 const a=await owner("27-clear");await seed(a.uid);
 await seedSummary(a.uid,"staff",[{name:"Private stylist",role:"Manager"}]);
 const {context,tab}=await page();
 try{
  await tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),a);await status(tab,"ready");
  await tab.waitForFunction(()=>document.querySelector('[data-summary="staff-items"] small')?.textContent==="Manager");
  await tab.locator('[data-nav-target="staff"]').click();
  await tab.evaluate(()=>window.__phase22.signOut());await status(tab,"signed-out");
  assert.equal(await tab.locator('[data-summary="staff-items"] li').count(),0);
  assert.equal(await tab.locator('[data-summary="service-items"] li').count(),0);
 }finally{await context.close();}
});
test("Management screens remain read-only on mobile and never offer edit actions",{timeout:45000},async()=>{
 const context=await browser.newContext({viewport:{width:360,height:740}}),tab=await context.newPage();
 try{
  await tab.goto(base);await tab.waitForFunction(()=>Boolean(window.__phase22));
  for(const section of ["services","staff"]){
   await tab.locator('[data-nav-target="'+section+'"]').click();
   assert.equal(await tab.locator('[data-nav-panel="'+section+'"] .readonly-tag').first().textContent(),"Read-only");
   assert.equal(await tab.locator('[data-nav-panel="'+section+'"] input, [data-nav-panel="'+section+'"] form, [data-nav-panel="'+section+'"] button').count(),0);
  }
  assert.equal(await tab.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }finally{await context.close();}
});

test("Verified owner sees weekly staff availability in read-only screen",{timeout:45000},async()=>{
 const a=await owner("28-hours");await seed(a.uid);
 await seedSummary(a.uid,"staff",[{name:"Taylor",workingHours:{Monday:{start:"09:00",end:"17:30"},Tuesday:{closed:true},friday:{start:"10:00",end:"15:00"}}}]);
 const {context,tab}=await page();
 try{
  await tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),a);await status(tab,"ready");
  await tab.waitForFunction(()=>document.querySelector('[data-summary="hours-items"] li')?.textContent.includes("Monday"));
  assert.deepEqual(await tab.locator('[data-summary="hours-items"] li').allTextContents(),["Taylor · Monday · 09:00–17:30","Taylor · Tuesday · Closed","Taylor · Friday · 10:00–15:00"]);
 }finally{await context.close();}
});
test("Invalid schedule times are not shown as working hours",{timeout:45000},async()=>{
 const a=await owner("28-invalid");await seed(a.uid);
 await seedSummary(a.uid,"staff",[{name:"Taylor",workingHours:{Monday:{start:"25:00",end:"17:00"},Tuesday:{start:"17:00",end:"09:00"}}}]);
 const {context,tab}=await page();
 try{
  await tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),a);await status(tab,"ready");
  await tab.waitForFunction(()=>document.querySelector('[data-summary="staff-summary"]').textContent==="1 staff member");
  assert.equal(await tab.locator('[data-summary="hours-items"] li').count(),0);
 }finally{await context.close();}
});
test("Unverified owner never sees staff availability",{timeout:45000},async()=>{
 const a=await owner("28-unverified",false);await seed(a.uid);
 await seedSummary(a.uid,"staff",[{name:"Secret",workingHours:{Monday:{start:"09:00",end:"17:00"}}}]);
 const {context,tab}=await page();
 try{
  await tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),a);await status(tab,"unverified");
  assert.equal(await tab.locator('[data-summary="hours-items"] li').count(),0);
 }finally{await context.close();}
});
test("Sign-out clears previously displayed availability",{timeout:45000},async()=>{
 const a=await owner("28-signout");await seed(a.uid);
 await seedSummary(a.uid,"staff",[{name:"Taylor",workingHours:{Monday:{start:"09:00",end:"17:00"}}}]);
 const {context,tab}=await page();
 try{
  await tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),a);await status(tab,"ready");
  await tab.waitForFunction(()=>document.querySelector('[data-summary="hours-items"] li')?.textContent.includes("Monday"));
  await tab.evaluate(()=>window.__phase22.signOut());await status(tab,"signed-out");
  assert.equal(await tab.locator('[data-summary="hours-items"] li').count(),0);
 }finally{await context.close();}
});
test("Business-wide hours are explicitly unavailable rather than invented",{timeout:45000},async()=>{
 const {context,tab}=await page();
 try{
  await tab.locator('[data-nav-target="staff"]').click();
  assert.match(await tab.locator('[data-business-hours="status"]').textContent(),/not available/);
  assert.equal(await tab.locator("form, input, [contenteditable], a[href]").count(),0);
 }finally{await context.close();}
});

test("Verified owner sees read-only business contact details and disabled settings",{timeout:45000},async()=>{
 const a=await owner("29-contact");await seed(a.uid);
 await rules.withSecurityRulesDisabled(async admin=>setDoc(doc(admin.firestore(),"users",a.uid,"business","profile"),{
  businessId:a.uid,name:"Boustio Demo",category:"Beauty",email:"hello@example.invalid",phone:"01234567890",
  address:"Example Street",description:"Premium services",acceptingBookings:false,published:false,schemaVersion:1,updatedAt:new Date()
 }));
 const {context,tab}=await page();
 try{
  await tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),a);await status(tab,"ready");
  await tab.waitForFunction(()=>document.querySelector('[data-profile="status"]').textContent.includes("Verified business profile"));
  await tab.locator('[data-nav-target="settings"]').click();
  assert.equal(await tab.locator('[data-profile="name"]').textContent(),"Boustio Demo");
  assert.equal(await tab.locator('[data-profile="email"]').textContent(),"hello@example.invalid");
  assert.equal(await tab.locator('[data-profile="phone"]').textContent(),"01234567890");
  assert.equal(await tab.locator('[data-profile="address"]').textContent(),"Example Street");
  assert.equal(await tab.locator('[data-profile="booking-mode"]').textContent(),"Customer bookings disabled");
  assert.equal(await tab.locator('[data-profile="publishing"]').textContent(),"Publishing disabled");
 }finally{await context.close();}
});
test("Unverified owner cannot view business profile settings",{timeout:45000},async()=>{
 const a=await owner("29-unverified",false);await seed(a.uid);const {context,tab}=await page();
 try{
  await tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),a);await status(tab,"unverified");
  assert.equal(await tab.locator('[data-profile="name"]').textContent(),"");
  assert.equal(await tab.locator('[data-profile="email"]').textContent(),"");
 }finally{await context.close();}
});
test("Sign-out removes all previously displayed private contact fields",{timeout:45000},async()=>{
 const a=await owner("29-signout");await seed(a.uid);const {context,tab}=await page();
 try{
  await tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),a);await status(tab,"ready");
  await tab.waitForFunction(()=>document.querySelector('[data-profile="status"]').textContent.includes("Verified business profile"));
  await tab.evaluate(()=>window.__phase22.signOut());await status(tab,"signed-out");
  for(const field of ["name","email","phone","address","description","booking-mode","publishing"])
   assert.equal(await tab.locator('[data-profile="'+field+'"]').textContent(),"");
 }finally{await context.close();}
});
test("Business profile HTML payload is rendered only as safe text",{timeout:45000},async()=>{
 const a=await owner("29-xss");await seed(a.uid);
 await rules.withSecurityRulesDisabled(async admin=>setDoc(doc(admin.firestore(),"users",a.uid,"business","profile"),{
  businessId:a.uid,name:"Test",category:"Hair",description:'<img src=x onerror="window.__profileXss=true">',
  acceptingBookings:false,published:false,schemaVersion:1,updatedAt:new Date()
 }));
 const {context,tab}=await page();
 try{
  await tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),a);await status(tab,"ready");
  await tab.waitForFunction(()=>document.querySelector('[data-profile="description"]').textContent.includes("<img"));
  assert.equal(await tab.locator('[data-profile="description"] img').count(),0);
  assert.equal(await tab.evaluate(()=>Boolean(window.__profileXss)),false);
 }finally{await context.close();}
});
test("Profile settings remain read-only on mobile without horizontal overflow",{timeout:45000},async()=>{
 const context=await browser.newContext({viewport:{width:360,height:740}}),tab=await context.newPage();
 try{
  await tab.goto(base);await tab.waitForFunction(()=>Boolean(window.__phase22));
  await tab.locator('[data-nav-target="settings"]').click();
  assert.equal(await tab.locator('[data-nav-panel="settings"] .readonly-tag').textContent(),"Read-only");
  assert.equal(await tab.locator('[data-nav-panel="settings"] input, [data-nav-panel="settings"] form, [data-nav-panel="settings"] button').count(),0);
  assert.equal(await tab.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }finally{await context.close();}
});

test("Service edit draft validation accepts bounded safe values but never saves",{timeout:45000},async()=>{
 const {context,tab}=await page();
 try{
  const result=await tab.evaluate(()=>({valid:window.__phase22.editing.validate("service",{name:"Haircut",price:25,duration:30}),submit:window.__phase22.editing.submit()}));
  assert.equal(result.valid.valid,true);assert.equal(result.submit.ok,false);
  assert.equal(result.submit.reason,"Editing disabled");
 }finally{await context.close();}
});
test("Service draft validation rejects malformed prices durations and unexpected fields",{timeout:45000},async()=>{
 const {context,tab}=await page();
 try{
  const results=await tab.evaluate(()=>[-1,NaN,Infinity,1.999,"25"].map(price=>window.__phase22.editing.validate("service",{name:"Haircut",price,duration:30}).valid));
  assert.deepEqual(results,[false,false,false,false,false]);
  assert.equal(await tab.evaluate(()=>window.__phase22.editing.validate("service",{name:"Haircut",price:25,duration:0,ownerUid:"someone"}).valid),false);
 }finally{await context.close();}
});
test("Staff draft validation rejects injected fields and malformed names",{timeout:45000},async()=>{
 const {context,tab}=await page();
 try{
  assert.equal(await tab.evaluate(()=>window.__phase22.editing.validate("staff",{name:"Alex",role:"Stylist"}).valid),true);
  assert.equal(await tab.evaluate(()=>window.__phase22.editing.validate("staff",{name:" ",role:"Stylist"}).valid),false);
  assert.equal(await tab.evaluate(()=>window.__phase22.editing.validate("staff",{name:"Alex",role:"Stylist",isAdmin:true}).valid),false);
 }finally{await context.close();}
});
test("Editing remains disabled for verified owner and no edit UI is present",{timeout:45000},async()=>{
 const a=await owner("210-noedit");await seed(a.uid);const {context,tab}=await page();
 try{
  await tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),a);await status(tab,"ready");
  assert.equal(await tab.evaluate(()=>window.__phase22.editing.enabled),false);
  assert.equal(await tab.evaluate(()=>window.__phase22.editing.submit({name:"Haircut"}).ok),false);
  assert.equal(await tab.locator("form, input, [contenteditable]").count(),0);
 }finally{await context.close();}
});
test("Editing cannot be enabled by a different owner or unverified session",{timeout:45000},async()=>{
 const a=await owner("210-unverified",false);const {context,tab}=await page();
 try{
  await tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),a);await status(tab,"unverified");
  assert.equal(await tab.evaluate(()=>window.__phase22.editing.enabled),false);
  assert.equal(await tab.evaluate(()=>window.__phase22.editing.submit().ok),false);
 }finally{await context.close();}
});

test("Narrow Samsung-width navigation has accessible 44px+ touch targets",{timeout:45000},async()=>{
 const context=await browser.newContext({viewport:{width:360,height:740},isMobile:true,hasTouch:true}),tab=await context.newPage();
 try{
  await tab.goto(base);await tab.waitForFunction(()=>Boolean(window.__phase22));
  const sizes=await tab.locator("[data-nav-target]").evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height));
  assert.equal(sizes.length,4);assert.ok(sizes.every(n=>n>=44),JSON.stringify(sizes));
  await tab.locator('[data-nav-target="staff"]').click();
  assert.equal(await tab.locator('[data-nav-panel="staff"]').isVisible(),true);
 }finally{await context.close();}
});
test("Mobile profile uses stacked labels and avoids horizontal page overflow",{timeout:45000},async()=>{
 const a=await owner("211-profile");await seed(a.uid);
 const context=await browser.newContext({viewport:{width:360,height:740}}),tab=await context.newPage();
 try{
  await tab.goto(base);await tab.waitForFunction(()=>Boolean(window.__phase22));
  await tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),a);await status(tab,"ready");
  await tab.locator('[data-nav-target="settings"]').click();
  const metrics=await tab.evaluate(()=>({cols:getComputedStyle(document.querySelector('[data-nav-panel="settings"] .profile dl')).gridTemplateColumns,overflow:document.documentElement.scrollWidth>innerWidth}));
  assert.equal(metrics.overflow,false);
  assert.equal(metrics.cols.split(" ").length,1);
 }finally{await context.close();}
});
test("Mobile keyboard focus is visibly outlined on navigation buttons",{timeout:45000},async()=>{
 const context=await browser.newContext({viewport:{width:390,height:844}}),tab=await context.newPage();
 try{
  await tab.goto(base);await tab.waitForFunction(()=>Boolean(window.__phase22));
  await tab.locator('[data-nav-target="services"]').focus();
  assert.equal(await tab.locator('[data-nav-target="services"]').evaluate(n=>getComputedStyle(n).outlineStyle),"solid");
  await tab.keyboard.press("Enter");
  assert.equal(await tab.locator('[data-nav-panel="services"]').isVisible(),true);
 }finally{await context.close();}
});
test("Long synthetic business details wrap on a 320px screen without horizontal overflow",{timeout:45000},async()=>{
 const a=await owner("211-long");await seed(a.uid);
 await rules.withSecurityRulesDisabled(async admin=>setDoc(doc(admin.firestore(),"users",a.uid,"business","profile"),{
  businessId:a.uid,name:"Boustio",category:"Hair",address:"Long".repeat(120),description:"Premium".repeat(120),
  acceptingBookings:false,published:false,schemaVersion:1,updatedAt:new Date()
 }));
 const context=await browser.newContext({viewport:{width:320,height:700}}),tab=await context.newPage();
 try{
  await tab.goto(base);await tab.waitForFunction(()=>Boolean(window.__phase22));
  await tab.evaluate(x=>window.__phase22.signIn(x.email,x.password),a);await status(tab,"ready");
  await tab.waitForFunction(()=>document.querySelector('[data-profile="address"]').textContent.length>100);
  await tab.locator('[data-nav-target="settings"]').click();
  assert.equal(await tab.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }finally{await context.close();}
});
test("Mobile visual polish never introduces editing booking or registration controls",{timeout:45000},async()=>{
 const context=await browser.newContext({viewport:{width:360,height:740}}),tab=await context.newPage();
 try{
  await tab.goto(base);await tab.waitForFunction(()=>Boolean(window.__phase22));
  for(const target of ["services","staff","settings"]){
   await tab.locator('[data-nav-target="'+target+'"]').click();
   assert.equal(await tab.locator("form, input, [contenteditable], a[href]").count(),0);
   assert.equal(await tab.evaluate(()=>window.__phase22.editing.enabled),false);
  }
 }finally{await context.close();}
});
