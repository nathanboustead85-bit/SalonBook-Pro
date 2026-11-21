"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"../web/phase30/booking-30-12.html"),"utf8"),js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
const elements=new Map();function el(id){if(!elements.has(id))elements.set(id,{value:id==="visitType"?"regular":"",textContent:"",hidden:true,disabled:true,style:{},attributes:{},children:[],listeners:{},replaceChildren(){this.children=[]},append(...x){this.children.push(...x)},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,fn){this.listeners[k]=fn},scrollIntoView(){this.scrolled=true}});return elements.get(id)}
const sandbox={document:{getElementById:el,createElement:()=>({textContent:"",className:"",attributes:{},children:[],listeners:{},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,fn){this.listeners[k]=fn},append(...x){this.children.push(...x)}})}};vm.createContext(sandbox);vm.runInContext(js,sandbox);const run=s=>vm.runInContext(s,sandbox);
const checks=[
["standalone HTML",/^<!doctype html>/i.test(html)],["phase 30.12",html.includes("Phase 30.12")],
["time filter group",html.includes('class="time-filter" role="group"')],["all filter",html.includes('id="filterAll"')],
["morning filter",html.includes('id="filterMorning"')],["afternoon filter",html.includes('id="filterAfternoon"')],
["evening filter",html.includes('id="filterEvening"')],["time filter guidance",html.includes('id="timeFilterHelp"')],
["live guidance",html.includes('id="timeFilterHelp" class="date-availability" aria-live="polite"')],
["filter style",html.includes(".time-filter-button{")],["pressed style",html.includes('.time-filter-button[aria-pressed="true"]')],
["filter function",html.includes("function selectTimePeriod(period)")],["period function",html.includes("function timePeriodFor(time)")],
["filtered slots",html.includes("function filteredSlots()")],["empty period message",html.includes("Try another time of day.")],
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
test("initial filter all",()=>assert.equal(run("timePeriod"),"all"));
test("initial pressed all",()=>assert.equal(el("filterAll").attributes["aria-pressed"],"true"));
test("morning period",()=>assert.equal(run('timePeriodFor("09:30")'),"morning"));
test("noon afternoon",()=>assert.equal(run('timePeriodFor("12:00")'),"afternoon"));
test("evening period",()=>assert.equal(run('timePeriodFor("17:00")'),"evening"));
test("invalid period rejected",()=>assert.equal(run('selectTimePeriod("invalid")'),false));
test("first date",()=>{el("dates").children[0].listeners.click();assert.equal(run("state.date"),"d1")});
test("all slots initially",()=>assert.equal(el("times").children.length,4));
test("morning filter",()=>{el("filterMorning").listeners.click();assert.equal(el("times").children.length,2)});
test("morning first time",()=>assert.equal(el("times").children[0].textContent,"09:00"));
test("morning pressed",()=>assert.equal(el("filterMorning").attributes["aria-pressed"],"true"));
test("afternoon filter",()=>{el("filterAfternoon").listeners.click();assert.equal(el("times").children.length,2)});
test("afternoon first time",()=>assert.equal(el("times").children[0].textContent,"13:00"));
test("select afternoon",()=>{el("times").children[0].listeners.click();assert.equal(run("state.time"),"13:00")});
test("evening filter",()=>{el("filterEvening").listeners.click();assert.equal(el("times").children.length,1)});
test("empty evening guidance",()=>assert.match(el("times").children[0].textContent,/No evening demo times/));
test("time selection preserved while filtering",()=>assert.equal(run("state.time"),"13:00"));
test("all filter restores slots",()=>{el("filterAll").listeners.click();assert.equal(el("times").children.length,4)});
test("barber filtering preserved",()=>{run('chooseStylist("sam")');assert.equal(el("times").children.length,2)});
test("incompatible time cleared",()=>assert.equal(run("state.time"),null));
test("later dates preserved",()=>{el("nextDates").listeners.click();assert.equal(run("datePage"),1)});
test("later date selectable",()=>{el("dates").children[0].listeners.click();assert.equal(run("state.date"),"d5")});
test("reset filter",()=>{run("startAnotherDemo()");assert.equal(run("timePeriod"),"all")});
test("reset date",()=>assert.equal(run("state.date"),null));
test("reset progress",()=>assert.equal(run("progressCount()"),0));
