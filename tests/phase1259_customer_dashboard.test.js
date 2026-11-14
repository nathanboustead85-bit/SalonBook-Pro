"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const html=fs.readFileSync("web/phase1259/index.html","utf8");
const test=(name,fn)=>{fn();console.log("PASS "+name)};
test("premium page script parses",()=>{const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,7);for(const s of scripts)if(s[1].trim())new vm.Script(s[1])});
for(const [name,fragment] of [
["dashboard anchor",'id="openDashboard"'],["dashboard section",'id="dashboard"'],["dashboard accessible label",'aria-label="Fictional appointment dashboard"'],
["empty state","No fictional appointments yet"],["empty state guidance","Choose a service, date and time below"],["management heading","Manage your appointments"],
["fictional badge","NOT BOOKED"],["appointment card","dash-card"],["customer privacy","No account, real booking or customer data"],
["dashboard cancellation","cancelDemo(index)"],["dashboard reschedule","startReschedule(index)"],["dashboard multiple holds","demoHolds.forEach((hold,index)"],
["dashboard refresh","renderDashboard();"],["dashboard on confirmation","renderManagement();renderDashboard();"],
["dashboard after cancellation","renderTimes();renderDashboard();"],["rescheduling mode","rescheduleMode=true"],
["reschedule index guard","index>=demoHolds.length"],["no real reservation","No email, payment or reservation"],
["mobile responsive","@media(max-width:370px)"],["teal theme","linear-gradient(135deg,#075b53,#0a8b7b)"],
["cancellation safety","NOT CANCELLED IN REAL LIFE"],["rescheduling safety","NOT CHANGED IN REAL LIFE"],
["existing management","Manage fictional appointment"],["no indexing","noindex,nofollow"],
["no editable personal data","input.readOnly=true"],["existing slot conflicts","Demo conflict"]
])test(name,()=>assert.ok(html.includes(fragment),name));
test("read-only no server network or storage",()=>{for(const bad of ["fetch(","XMLHttpRequest","localStorage","sessionStorage","firebase.initializeApp","<form","WebSocket(","sendBeacon(","indexedDB"])assert.ok(!html.includes(bad),bad)});
const manage=require("../web/phase1258/managementPreview");
test("dashboard cancellation reuses pure engine",()=>{const holds=[{date:"2026-11-23",staffId:"sam",start:840,end:870}];const response=manage.cancel({holds,index:0});assert.equal(response.holds.length,0);assert.equal(holds.length,1)});
test("dashboard reschedule conflict safety",()=>{const holds=[{date:"2026-11-23",staffId:"sam",start:840,end:870},{date:"2026-11-23",staffId:"sam",start:900,end:930}];const response=manage.reschedule({holds,index:0,request:{status:"PREVIEW_ONLY",date:"2026-11-23",staffId:"sam",time:"15:00",end:"15:30"}});assert.equal(response.status,"DEMO_RESCHEDULE_CONFLICT");assert.equal(holds[0].start,840)});
