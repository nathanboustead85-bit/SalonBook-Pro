"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const root="web/phase1254/",html=fs.readFileSync(root+"index.html","utf8");
const context={window:{},console,Date,Set,Map,Object,Array,String,Number,Math};vm.createContext(context);
for(const file of ["availabilityPreview.js","smartAvailability.js"])vm.runInContext(fs.readFileSync(root+file,"utf8"),context,{filename:file});
const smart=context.window.BoustioPhase1254,profile=smart.demoProfile(),today="2026-11-14";
function get(date,serviceId="cut",staffId="any"){return smart.calculate({date,today,serviceId,staffId,profile})}
function check(name,fn){fn();console.log("PASS "+name)}
check("browser exposes smart calculator",()=>assert.equal(typeof smart.calculate,"function"));
check("browser exposes demo salon",()=>assert.equal(profile.published,true));
check("Friday available",()=>assert.ok(get("2026-11-20").slots.length>0));
check("Alex 09:30 blocked",()=>assert.ok(!get("2026-11-20","cut","alex").slots.some(s=>s.time==="09:30")));
check("Alex 09:00 available",()=>assert.ok(get("2026-11-20","cut","alex").slots.some(s=>s.time==="09:00")));
check("Sam 11:00 blocked",()=>assert.ok(!get("2026-11-20","cut","sam").slots.some(s=>s.time==="11:00")));
check("Alex Friday lunch blocked",()=>assert.ok(!get("2026-11-20","cut","alex").slots.some(s=>s.time==="12:00")));
check("Alex holiday blocked",()=>assert.equal(get("2026-11-23","cut","alex").slots.length,0));
check("Sam available on Alex holiday",()=>assert.ok(get("2026-11-23","cut","sam").slots.length>0));
check("Sam does colour",()=>assert.ok(get("2026-11-20","colour","sam").slots.length>0));
check("Alex cannot do colour",()=>assert.equal(get("2026-11-20","colour","alex").slots.length,0));
check("Saturday Alex available",()=>assert.ok(get("2026-11-21","cut","alex").slots.length>0));
check("Saturday Sam unavailable",()=>assert.equal(get("2026-11-21","cut","sam").slots.length,0));
check("Sunday closed",()=>assert.equal(get("2026-11-22").slots.length,0));
check("future dates restricted",()=>assert.equal(get("2027-02-01").slots.length,0));
check("synthetic response never books",()=>assert.equal(get("2026-11-20").bookingEnabled,false));
check("customer private data absent",()=>assert.ok(!JSON.stringify(get("2026-11-20")).includes("customerName")));
for(const [name,pattern] of [["mobile viewport",/name="viewport"/],["month navigation",/id="next"/],["real slot engine",/smart\.calculate\(/],["available date gating",/const enabled=d.enabled&&smart\.calculate/],["occupied slots excluded",/const available=smart\.calculate/],["review rechecks availability",/const valid=smart\.calculate/],["not booked warning",/DEMO ONLY — NOT BOOKED/],["fictional warning",/Fictional salon data only/],["noindex",/noindex,nofollow/],["script inclusion",/src="\.\/smartAvailability.js"/]])check(name,()=>assert.match(html,pattern));
check("no live firebase calls",()=>assert.doesNotMatch(html,/fetch\s*\(|firebase\.initializeApp|firestore\.googleapis|salonbook-pro-ad5ff/));
check("no submit forms",()=>assert.doesNotMatch(html,/<form|type="submit"|method="POST"/));
