"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"../web/phase30/booking-30-13.html"),"utf8"),js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
const elements=new Map();function el(id){if(!elements.has(id))elements.set(id,{value:id==="visitType"?"regular":"",textContent:"",hidden:true,disabled:true,style:{},attributes:{},children:[],listeners:{},replaceChildren(){this.children=[]},append(...x){this.children.push(...x)},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,fn){this.listeners[k]=fn},scrollIntoView(){this.scrolled=true}});return elements.get(id)}
const sandbox={document:{getElementById:el,createElement:()=>({textContent:"",className:"",attributes:{},children:[],listeners:{},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,fn){this.listeners[k]=fn},append(...x){this.children.push(...x)}})}};vm.createContext(sandbox);vm.runInContext(js,sandbox);const run=s=>vm.runInContext(s,sandbox);
const checks=[
["standalone HTML",/^<!doctype html>/i.test(html)],["phase 30.13",html.includes("Phase 30.13")],
["selected time panel",html.includes('class="selected-time-panel" aria-live="polite"')],["selected label",html.includes('id="selectedTimeLabel"')],
["selected guidance",html.includes('id="selectedTimeHelp"')],["clear button",html.includes('id="clearTime"')],
["clear disabled initially",html.includes('id="clearTime" class="clear-time-button" disabled')],
["render selected function",html.includes("function renderSelectedTime()")],["clear function",html.includes("function clearSelectedTime()")],
["hidden guidance",html.includes("hidden by this filter")],["visible guidance",html.includes("visible above")],
["selected CSS",html.includes(".selected-time-panel{")],["clear CSS",html.includes(".clear-time-button{")],
["clear focus CSS",html.includes(".clear-time-button:focus-visible")],["small screen CSS",html.includes("@media(max-width:380px){.selected-time-panel")],
["all filter retained",html.includes('id="filterAll"')],["morning filter retained",html.includes('id="filterMorning"')],
["afternoon filter retained",html.includes('id="filterAfternoon"')],["evening filter retained",html.includes('id="filterEvening"')],
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
test("initial selection label",()=>assert.equal(el("selectedTimeLabel").textContent,"No appointment time selected"));
test("initial clear disabled",()=>assert.equal(el("clearTime").disabled,true));
test("clear without selection rejected",()=>assert.equal(run("clearSelectedTime()"),false));
test("date selection",()=>{el("dates").children[0].listeners.click();assert.equal(run("state.date"),"d1")});
test("time selection",()=>{el("times").children[0].listeners.click();assert.equal(run("state.time"),"09:00")});
test("selected time visible",()=>assert.match(el("selectedTimeLabel").textContent,/09:00/));
test("selected date visible",()=>assert.match(el("selectedTimeLabel").textContent,/Mon 23 Nov/));
test("clear enabled",()=>assert.equal(el("clearTime").disabled,false));
test("visible status",()=>assert.match(el("selectedTimeHelp").textContent,/visible above/));
test("afternoon filter",()=>{el("filterAfternoon").listeners.click();assert.equal(run("timePeriod"),"afternoon")});
test("selection survives filter",()=>assert.equal(run("state.time"),"09:00"));
test("hidden status",()=>assert.match(el("selectedTimeHelp").textContent,/hidden by this filter/));
test("hidden selection still displayed",()=>assert.match(el("selectedTimeLabel").textContent,/09:00/));
test("all filter",()=>{el("filterAll").listeners.click();assert.match(el("selectedTimeHelp").textContent,/visible above/)});
test("clear selection",()=>{el("clearTime").listeners.click();assert.equal(run("state.time"),null)});
test("clear label",()=>assert.equal(el("selectedTimeLabel").textContent,"No appointment time selected"));
test("clear disabled after",()=>assert.equal(el("clearTime").disabled,true));
test("date retained after clear",()=>assert.equal(run("state.date"),"d1"));
test("select another time",()=>{el("times").children[2].listeners.click();assert.equal(run("state.time"),"13:00")});
test("selected time updated",()=>assert.match(el("selectedTimeLabel").textContent,/13:00/));
test("barber invalidates time",()=>{run('chooseStylist("sam")');assert.equal(run("state.time"),null)});
test("barber invalidation clears label",()=>assert.equal(el("selectedTimeLabel").textContent,"No appointment time selected"));
test("next page",()=>{el("nextDates").listeners.click();assert.equal(run("datePage"),1)});
test("later date",()=>{el("dates").children[0].listeners.click();assert.equal(run("state.date"),"d5")});
test("later time",()=>{el("times").children[0].listeners.click();assert.equal(run("state.time"),"09:00")});
test("later date status",()=>assert.match(el("selectedTimeLabel").textContent,/Fri 27 Nov/));
test("reset",()=>{run("startAnotherDemo()");assert.equal(run("state.time"),null)});
test("reset date",()=>assert.equal(run("state.date"),null));
test("reset filter",()=>assert.equal(run("timePeriod"),"all"));
test("reset progress",()=>assert.equal(run("progressCount()"),0));
