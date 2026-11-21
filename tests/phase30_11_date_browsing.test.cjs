"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"../web/phase30/booking-30-11.html"),"utf8"),js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
const elements=new Map();function el(id){if(!elements.has(id))elements.set(id,{value:id==="visitType"?"regular":"",textContent:"",hidden:true,disabled:true,style:{},attributes:{},children:[],listeners:{},replaceChildren(){this.children=[]},append(...x){this.children.push(...x)},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,fn){this.listeners[k]=fn},scrollIntoView(){this.scrolled=true}});return elements.get(id)}
const sandbox={document:{getElementById:el,createElement:()=>({textContent:"",className:"",attributes:{},children:[],listeners:{},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,fn){this.listeners[k]=fn},append(...x){this.children.push(...x)}})}};vm.createContext(sandbox);vm.runInContext(js,sandbox);const run=s=>vm.runInContext(s,sandbox);
const checks=[
["standalone HTML",/^<!doctype html>/i.test(html)],["phase 30.11",html.includes("Phase 30.11")],
["date browser",html.includes('class="date-browser"')],["earlier button",html.includes('id="previousDates"')],
["later button",html.includes('id="nextDates"')],["date range",html.includes('id="dateRange"')],
["availability",html.includes('id="dateAvailability"')],["date range live",html.includes('id="dateRange" aria-live="polite"')],
["availability live",html.includes('id="dateAvailability" class="date-availability" aria-live="polite"')],
["extra dates",html.includes("const extraDates=")],["extra slots",html.includes("const extraSlots=")],
["page bounds",html.includes("Math.max(0,Math.min(2,datePage+delta))")],
["page CSS",html.includes(".date-browser{")],["mobile CSS",html.includes("@media(max-width:380px){.date-page")],
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
test("12 demo dates",()=>assert.equal(run("allDates.length"),12));
test("initial page",()=>assert.equal(run("datePage"),0));
test("initial 4 visible",()=>assert.equal(el("dates").children.length,4));
test("initial earlier disabled",()=>assert.equal(el("previousDates").disabled,true));
test("initial later enabled",()=>assert.equal(el("nextDates").disabled,false));
test("initial availability guidance",()=>assert.match(el("dateAvailability").textContent,/Select a demo date/));
test("next page",()=>{el("nextDates").listeners.click();assert.equal(run("datePage"),1)});
test("next page has 4",()=>assert.equal(el("dates").children.length,4));
test("second page starts d5",()=>assert.equal(el("dates").children[0].textContent,"Fri 27 Nov"));
test("select second page date",()=>{el("dates").children[0].listeners.click();assert.equal(run("state.date"),"d5")});
test("second page times",()=>assert.equal(el("times").children.length,3));
test("availability count",()=>assert.match(el("dateAvailability").textContent,/3 illustrative times/));
test("select second page time",()=>{el("times").children[0].listeners.click();assert.equal(run("state.time"),"09:00")});
test("summary uses extra date",()=>assert.match(el("sumDate").textContent,/27 November/));
test("page 3",()=>{el("nextDates").listeners.click();assert.equal(run("datePage"),2)});
test("last page ends d12",()=>assert.equal(el("dates").children[3].textContent,"Tue 8 Dec"));
test("last page later disabled",()=>assert.equal(el("nextDates").disabled,true));
test("can't go beyond last page",()=>assert.equal(run("changeDatePage(1)"),false));
test("previous page",()=>{el("previousDates").listeners.click();assert.equal(run("datePage"),1)});
test("previous doesn't lose date",()=>assert.equal(run("state.date"),"d5"));
test("previous doesn't lose time",()=>assert.equal(run("state.time"),"09:00"));
test("stylist filters extra dates",()=>{run('chooseStylist("alex")');assert.equal(run("availableSlots().length"),1)});
test("invalid time cleared on stylist change",()=>assert.equal(run("state.time"),null));
test("alex extra date time",()=>{el("times").children[0].listeners.click();assert.equal(run("state.time"),"14:30")});
test("reset page",()=>{run("startAnotherDemo()");assert.equal(run("datePage"),0)});
test("reset date",()=>assert.equal(run("state.date"),null));
test("reset time",()=>assert.equal(run("state.time"),null));
test("reset shows first four dates",()=>assert.equal(el("dates").children[0].textContent,"Mon 23 Nov"));
test("reset progress",()=>assert.equal(run("progressCount()"),0));
