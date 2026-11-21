"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"../web/phase30/booking-30-7.html"),"utf8"),js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
const elements=new Map();function el(id){if(!elements.has(id))elements.set(id,{value:id==="visitType"?"regular":"",textContent:"",hidden:true,disabled:true,style:{},attributes:{},children:[],listeners:{},replaceChildren(){this.children=[]},append(...x){this.children.push(...x)},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,fn){this.listeners[k]=fn},scrollIntoView(){}});return elements.get(id)}
const sandbox={document:{getElementById:el,createElement:()=>({textContent:"",className:"",attributes:{},children:[],listeners:{},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,fn){this.listeners[k]=fn},append(...x){this.children.push(...x)}})}};vm.createContext(sandbox);vm.runInContext(js,sandbox);const run=s=>vm.runInContext(s,sandbox);
const checks=[
["standalone HTML",/^<!doctype html>/i.test(html)],
["valid script",!!js],
["phase label",html.includes("Phase 30.7")],
["profile section",html.includes('class="salon-profile"')],
["profile heading",html.includes('id="salonProfileHeading"')],
["profile name",html.includes("Welcome to Kody Blends")],
["gallery",html.includes('class="salon-gallery"')],
["gallery accessibility",html.includes('aria-label="Decorative salon gallery illustrations"')],
["three gallery tiles",(html.match(/class="gallery-tile /g)||[]).length===3],
["cuts gallery",html.includes("Fresh cuts")],
["styling gallery",html.includes("Sharp styling")],
["care gallery",html.includes("Attention to detail")],
["gallery cut gradient",html.includes(".gallery-cut{background:linear-gradient")],
["gallery style gradient",html.includes(".gallery-style{background:linear-gradient")],
["gallery care gradient",html.includes(".gallery-care{background:linear-gradient")],
["demo location",html.includes("Torquay, Devon · Example area only")],
["example hours",html.includes("Monday–Friday · 09:00–17:00")],
["service categories",html.includes("Haircuts, fades, beard trims")],
["not verified address",html.includes("Not a verified address")],
["not actual gallery",html.includes("actual gallery")],
["not live schedule",html.includes("live schedule")],
["not live booking",html.includes("booking service")],
["illustrative profile disclaimer",html.includes("All location and opening-hour details below are illustrative")],
["premium hero retained",html.includes('class="hero"')],
["service cards retained",html.includes("service-card")],
["progress retained",html.includes('id="progressSteps"')],
["stylist retained",html.includes('id="stylists"')],
["date retained",html.includes('id="dates"')],
["times retained",html.includes('id="times"')],
["customer details retained",html.includes('id="customerName"')],
["preferences retained",html.includes('id="visitType"')],
["notes retained",html.includes('id="bookingNotes"')],
["summary retained",html.includes('id="sumService"')],
["confirmation retained",html.includes('id="confirmationDetails"')],
["reset retained",html.includes('id="startAgain"')],
["mobile profile layout",html.includes(".salon-info-grid{grid-template-columns:1fr}")],
["small screen gallery",html.includes("@media(max-width:360px)")],
["no external images",!/<img[^>]+src=["']https?:/i.test(html)],
["no external CSS",!/<link[^>]+stylesheet/i.test(html)],
["no network",!["fetch(","XMLHttpRequest","WebSocket(","EventSource(","sendBeacon("].some(x=>html.includes(x))],
["no storage",!["localStorage","sessionStorage","indexedDB","document.cookie"].some(x=>html.includes(x))],
["no Firebase",!/firebaseConfig|firebase\/app|firebase\.firestore/.test(html)],
["no form submission",!/<form\b/i.test(html)],
["no payments",html.includes("no payment is taken")],
["no data transmitted",html.includes("no customer information is saved or transmitted")],
["no real appointments",html.includes("No appointment was created.")],
["noindex",html.includes("noindex,nofollow")],
["safe DOM",!js.includes(".innerHTML")],
["reduced motion",html.includes("prefers-reduced-motion")],
];
for(const [name,ok] of checks)test(name,()=>assert.equal(ok,true));
test("JavaScript compiles",()=>new vm.Script(js));
test("four services retained",()=>assert.equal(run("services.length"),4));
test("four service cards rendered",()=>assert.equal(el("services").children.length,4));
test("select service updates summary",()=>{el("services").children[1].listeners.click();assert.equal(el("sumService").textContent,"Skin Fade")});
test("select service updates price",()=>assert.equal(el("sumPrice").textContent,"£25.00"));
test("progress updates",()=>assert.ok(run("progressCount()")>=3));
test("confirmation works",()=>{run('state.service="cut";state.stylist="sam";state.date="d1";state.time="09:00"');el("customerName").value="Demo Person";el("customerEmail").value="demo@example.test";assert.equal(run("showConfirmation()"),true)});
test("reset clears booking",()=>{run("startAnotherDemo()");assert.equal(run("state.service"),null)});
test("reset hides confirmation",()=>assert.equal(el("confirmation").hidden,true));
