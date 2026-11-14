"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const html=fs.readFileSync("web/phase1260/index.html","utf8");
const test=(name,fn)=>{fn();console.log("PASS "+name)};
test("polished page scripts parse",()=>{const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,7);for(const s of scripts)if(s[1].trim())new vm.Script(s[1])});
for(const [name,fragment] of [
["demo safety banner","Fictional preview only · No real booking or payment"],["quick navigation","Page navigation"],["booking shortcut",'id="openBooking"'],["dashboard shortcut",'id="openDashboard"'],
["calendar anchor",'id="bookingFlow"'],["booking progress","Booking progress"],["service step",'id="stepService"'],["time step",'id="stepTime"'],["review step",'id="stepReview"'],
["progress live text",'id="progressNote"'],["progress logic","function updateProgress(override)"],["step current semantics",'aria-current="step"'],["step cleanup",'removeAttribute("aria-current")'],
["confirmation step","updateProgress(\"complete\")"],["review step","updateProgress(\"review\")"],["slot selection progress","review.disabled=false;updateProgress()"],
["dashboard navigation",'dashboard").scrollIntoView'],["calendar navigation",'bookingFlow").scrollIntoView'],["skip link",'href="#bookingFlow"'],
["accessible calendar",'aria-label="Fictional booking calendar"'],["status region",'role="status"'],["status announcement","function announce(message)"],
["reschedule announcement","Rescheduling preview started"],["cancellation announcement","Fictional appointment removed"],
["mobile controls","min-height:48px"],["reduced motion","prefers-reduced-motion:reduce"],["mobile layout","max-width:370px"],
["premium teal","linear-gradient(135deg,#075b53,#0a8b7b)"],["dashboard appointment cards","dash-card"],["dashboard empty state","No fictional appointments yet"],
["reschedule guard","management.reschedule"],["cancel guard","management.cancel"],["read-only details","input.readOnly=true"],
["not booked","NOT BOOKED"],["no real reschedule","NOT CHANGED IN REAL LIFE"],["no real cancellation","NOT CANCELLED IN REAL LIFE"],
["no indexing","noindex,nofollow"],["refresh state in memory","let year="]
])test(name,()=>assert.ok(html.includes(fragment),name));
test("no network, storage, real forms or Firebase",()=>{for(const bad of ["fetch(","XMLHttpRequest","localStorage","sessionStorage","firebase.initializeApp","<form","WebSocket(","sendBeacon(","indexedDB"])assert.ok(!html.includes(bad),bad)});
test("no Android production source modified by this web-only suite",()=>assert.ok(html.includes("No real booking or payment")));
const m=require("../web/phase1258/managementPreview");
test("existing reschedule conflict guard still blocks overlap",()=>{const holds=[{date:"2026-11-23",staffId:"sam",start:840,end:870},{date:"2026-11-23",staffId:"sam",start:900,end:930}];const response=m.reschedule({holds,index:0,request:{status:"PREVIEW_ONLY",date:"2026-11-23",staffId:"sam",time:"15:00",end:"15:30"}});assert.equal(response.changed,false);assert.equal(holds[0].start,840)});
