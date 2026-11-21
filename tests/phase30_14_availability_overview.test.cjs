"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"../web/phase30/booking-30-14.html"),"utf8"),js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
const elements=new Map();function el(id){if(!elements.has(id))elements.set(id,{value:id==="visitType"?"regular":"",textContent:"",hidden:true,disabled:true,style:{},attributes:{},children:[],listeners:{},replaceChildren(){this.children=[]},append(...x){this.children.push(...x)},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,fn){this.listeners[k]=fn},scrollIntoView(){this.scrolled=true}});return elements.get(id)}
const sandbox={document:{getElementById:el,createElement:()=>({textContent:"",className:"",attributes:{},children:[],listeners:{},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,fn){this.listeners[k]=fn},append(...x){this.children.push(...x)}})}};vm.createContext(sandbox);vm.runInContext(js,sandbox);const run=s=>vm.runInContext(s,sandbox);
const checks=[
["standalone HTML",/^<!doctype html>/i.test(html)],["phase 30.14",html.includes("Phase 30.14")],
["overview panel",html.includes('id="availabilityOverview"')],["overview status",html.includes('class="availability-overview" role="status" aria-live="polite"')],
["total count",html.includes('id="countAll"')],["morning count",html.includes('id="countMorning"')],
["afternoon count",html.includes('id="countAfternoon"')],["evening count",html.includes('id="countEvening"')],
["overview renderer",html.includes("function renderAvailabilityOverview()")],["overview CSS",html.includes(".availability-overview{")],
["responsive overview",html.includes("@media(max-width:420px){.availability-overview")],
["all filter retained",html.includes('id="filterAll"')],["morning filter retained",html.includes('id="filterMorning"')],
["afternoon filter retained",html.includes('id="filterAfternoon"')],["evening filter retained",html.includes('id="filterEvening"')],
["selected time panel retained",html.includes('id="selectedTimeLabel"')],["clear time retained",html.includes('id="clearTime"')],
["date browser retained",html.includes('id="nextDates"')],["12 demo dates retained",html.includes("const extraDates=")],
["service cards retained",html.includes("service-card")],["salon profile retained",html.includes('class="salon-profile"')],
["gallery retained",html.includes('class="salon-gallery"')],["progress retained",html.includes('id="progressSteps"')],
["barber retained",html.includes('id="stylists"')],["dates retained",html.includes('id="dates"')],
["times retained",html.includes('id="times"')],["customer details retained",html.includes('id="customerName"')],
["preferences retained",html.includes('id="visitType"')],["notes retained",html.includes('id="bookingNotes"')],
["confirmation retained",html.includes('id="confirmationDetails"')],["reset retained",html.includes('id="startAgain"')],
["name validation retained",html.includes('id="nameHelp"')],["email validation retained",html.includes('id="emailHelp"')],
["readiness retained",html.includes('id="bookingReadiness"')],["edit buttons retained",html.includes('id="editService"')],
["no remote image",!/<img[^>]+src=["']https?:/i.test(html)],["no external CSS",!/<link[^>]+stylesheet/i.test(html)],
["no network",!["fetch(","XMLHttpRequest","WebSocket(","EventSource(","sendBeacon("].some(x=>html.includes(x))],
["no storage",!["localStorage","sessionStorage","indexedDB","document.cookie"].some(x=>html.includes(x))],
["no Firebase",!/firebaseConfig|firebase\/app|firebase\.firestore/.test(html)],["no form submission",!/<form\b/i.test(html)],
["no payments",html.includes("no payment is taken")],["no data transmitted",html.includes("no customer information is saved or transmitted")],
["no real appointment",html.includes("No appointment was created.")],["noindex",html.includes("noindex,nofollow")],
["safe DOM",!js.includes(".innerHTML")],["reduced motion",html.includes("prefers-reduced-motion")]
];for(const [name,ok] of checks)test(name,()=>assert.equal(ok,true));
test("JS compiles",()=>new vm.Script(js));
test("initial zero total",()=>assert.equal(el("countAll").textContent,"All · 0"));
test("initial zero morning",()=>assert.equal(el("countMorning").textContent,"Morning · 0"));
test("initial zero afternoon",()=>assert.equal(el("countAfternoon").textContent,"Afternoon · 0"));
test("initial zero evening",()=>assert.equal(el("countEvening").textContent,"Evening · 0"));
test("initial guidance",()=>assert.match(el("availabilityOverview").attributes["aria-label"],/Choose a date/));
test("select first date",()=>{el("dates").children[0].listeners.click();assert.equal(run("state.date"),"d1")});
test("first date total",()=>assert.equal(el("countAll").textContent,"All · 4"));
test("first date morning",()=>assert.equal(el("countMorning").textContent,"Morning · 2"));
test("first date afternoon",()=>assert.equal(el("countAfternoon").textContent,"Afternoon · 2"));
test("first date evening",()=>assert.equal(el("countEvening").textContent,"Evening · 0"));
test("accessibility count",()=>assert.match(el("availabilityOverview").attributes["aria-label"],/4 total, 2 morning/));
test("morning filter",()=>{el("filterMorning").listeners.click();assert.equal(el("times").children.length,2)});
test("counts stable while filtering",()=>assert.equal(el("countAll").textContent,"All · 4"));
test("select morning time",()=>{el("times").children[0].listeners.click();assert.equal(run("state.time"),"09:00")});
test("afternoon filter",()=>{el("filterAfternoon").listeners.click();assert.equal(el("times").children.length,2)});
test("time preserved",()=>assert.equal(run("state.time"),"09:00"));
test("selected panel hidden guidance",()=>assert.match(el("selectedTimeHelp").textContent,/hidden by this filter/));
test("barber selection",()=>{run('chooseStylist("sam")');assert.equal(run("state.stylist"),"sam")});
test("barber total updates",()=>assert.equal(el("countAll").textContent,"All · 2"));
test("barber morning updates",()=>assert.equal(el("countMorning").textContent,"Morning · 2"));
test("barber afternoon updates",()=>assert.equal(el("countAfternoon").textContent,"Afternoon · 0"));
test("later date browsing",()=>{el("nextDates").listeners.click();assert.equal(run("datePage"),1)});
test("later date selection",()=>{el("dates").children[0].listeners.click();assert.equal(run("state.date"),"d5")});
test("later date counts",()=>assert.equal(el("countAll").textContent,"All · 2"));
test("later date morning",()=>assert.equal(el("countMorning").textContent,"Morning · 2"));
test("later date afternoon",()=>assert.equal(el("countAfternoon").textContent,"Afternoon · 0"));
test("reset",()=>{run("startAnotherDemo()");assert.equal(run("state.date"),null)});
test("reset counts",()=>assert.equal(el("countAll").textContent,"All · 0"));
test("reset time",()=>assert.equal(run("state.time"),null));
test("reset filter",()=>assert.equal(run("timePeriod"),"all"));
test("reset progress",()=>assert.equal(run("progressCount()"),0));
