"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"../web/phase30/booking-30-9.html"),"utf8"),js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
const elements=new Map();function el(id){if(!elements.has(id))elements.set(id,{value:id==="visitType"?"regular":"",textContent:"",hidden:true,disabled:true,style:{},attributes:{},children:[],listeners:{},replaceChildren(){this.children=[]},append(...x){this.children.push(...x)},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,fn){this.listeners[k]=fn},append(...x){this.children.push(...x)},scrollIntoView(){this.scrolled=true}});return elements.get(id)}
const sandbox={document:{getElementById:el,createElement:()=>({textContent:"",className:"",attributes:{},children:[],listeners:{},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,fn){this.listeners[k]=fn},append(...x){this.children.push(...x)}})}};vm.createContext(sandbox);vm.runInContext(js,sandbox);const run=s=>vm.runInContext(s,sandbox);
const checks=[
["standalone HTML",/^<!doctype html>/i.test(html)],["phase 30.9",html.includes("Phase 30.9")],
["name helper",html.includes('id="nameHelp"')],["email helper",html.includes('id="emailHelp"')],
["name aria description",html.includes('aria-describedby="nameHelp"')],["email aria description",html.includes('aria-describedby="emailHelp"')],
["readiness helper",html.includes('id="bookingReadiness"')],["readiness live",html.includes('id="bookingReadiness" class="booking-readiness" aria-live="polite"')],
["name helper live",html.includes('id="nameHelp" aria-live="polite"')],["email helper live",html.includes('id="emailHelp" aria-live="polite"')],
["validation visual",html.includes('input[aria-invalid="true"]')],["validation functions",html.includes("function renderDetailsValidation()")],
["touched tracking",html.includes("const detailsTouched=")],["readiness function",html.includes("function bookingReadiness()")],
["service cards retained",html.includes("service-card")],["salon profile retained",html.includes('class="salon-profile"')],
["gallery retained",html.includes('class="salon-gallery"')],["progress retained",html.includes('id="progressSteps"')],
["barber retained",html.includes('id="stylists"')],["date retained",html.includes('id="dates"')],
["times retained",html.includes('id="times"')],["preferences retained",html.includes('id="visitType"')],
["notes retained",html.includes('id="bookingNotes"')],["confirmation retained",html.includes('id="confirmationDetails"')],
["reset retained",html.includes('id="startAgain"')],["no remote image",!/<img[^>]+src=["']https?:/i.test(html)],
["no external CSS",!/<link[^>]+stylesheet/i.test(html)],
["no network",!["fetch(","XMLHttpRequest","WebSocket(","EventSource(","sendBeacon("].some(x=>html.includes(x))],
["no storage",!["localStorage","sessionStorage","indexedDB","document.cookie"].some(x=>html.includes(x))],
["no Firebase",!/firebaseConfig|firebase\/app|firebase\.firestore/.test(html)],["no form submission",!/<form\b/i.test(html)],
["no payments",html.includes("no payment is taken")],["no data transmitted",html.includes("no customer information is saved or transmitted")],
["no real appointment",html.includes("No appointment was created.")],["noindex",html.includes("noindex,nofollow")],
["safe DOM",!js.includes(".innerHTML")],["reduced motion",html.includes("prefers-reduced-motion")]
];for(const [name,ok] of checks)test(name,()=>assert.equal(ok,true));
test("JS compiles",()=>new vm.Script(js));
test("starts at zero",()=>assert.equal(run("progressCount()"),0));
test("initial readiness",()=>assert.equal(el("bookingReadiness").textContent,"Choose a service to get started."));
test("no initial name error",()=>assert.equal(el("customerName").attributes["aria-invalid"],"false"));
test("no initial email error",()=>assert.equal(el("customerEmail").attributes["aria-invalid"],"false"));
test("service selection updates readiness",()=>{el("services").children[0].listeners.click();assert.match(el("bookingReadiness").textContent,/Choose a date/)});
test("date and time updates readiness",()=>{el("dates").children[0].listeners.click();el("times").children[0].listeners.click();assert.match(el("bookingReadiness").textContent,/Enter your name/)});
test("short name shows error",()=>{el("customerName").value="A";el("customerName").listeners.input();assert.equal(el("customerName").attributes["aria-invalid"],"true")});
test("name helper explains error",()=>assert.match(el("nameHelp").textContent,/at least 2/));
test("invalid email shows error",()=>{el("customerEmail").value="bad-email";el("customerEmail").listeners.input();assert.equal(el("customerEmail").attributes["aria-invalid"],"true")});
test("email helper explains error",()=>assert.match(el("emailHelp").textContent,/valid email/));
test("corrected name clears error",()=>{el("customerName").value="Demo Person";el("customerName").listeners.input();assert.equal(el("customerName").attributes["aria-invalid"],"false")});
test("corrected email clears error",()=>{el("customerEmail").value="demo@example.test";el("customerEmail").listeners.input();assert.equal(el("customerEmail").attributes["aria-invalid"],"false")});
test("valid details readiness",()=>assert.match(el("bookingReadiness").textContent,/Ready to preview/));
test("valid details enable preview",()=>assert.equal(el("confirm").disabled,false));
test("confirmation works",()=>assert.equal(run("showConfirmation()"),true));
test("reset clears touched",()=>{run("startAnotherDemo()");assert.equal(run("detailsTouched.name"),false)});
test("reset clears email touched",()=>assert.equal(run("detailsTouched.email"),false));
test("reset clears errors",()=>assert.equal(el("customerName").attributes["aria-invalid"],"false"));
test("reset clears readiness",()=>assert.equal(el("bookingReadiness").textContent,"Choose a service to get started."));
test("reset hides confirmation",()=>assert.equal(el("confirmation").hidden,true));
test("reset clears progress",()=>assert.equal(run("progressCount()"),0));
test("phone remains optional",()=>assert.equal(run("validDetails()"),false));
test("booking validation still rejects invalid email",()=>{el("customerName").value="Demo";el("customerEmail").value="not-an-email";assert.equal(run("canPreview()"),false)});
test("booking validation still accepts correct details",()=>{run('state.service="cut";state.date="d1";state.time="09:00"');el("customerEmail").value="demo@example.test";assert.equal(run("canPreview()"),true)});
