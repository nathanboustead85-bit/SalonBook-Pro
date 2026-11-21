"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"../web/phase30/booking-30-8.html"),"utf8"),js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
const elements=new Map();function el(id){if(!elements.has(id))elements.set(id,{value:id==="visitType"?"regular":"",textContent:"",hidden:true,disabled:true,style:{},attributes:{},children:[],listeners:{},replaceChildren(){this.children=[]},append(...x){this.children.push(...x)},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,fn){this.listeners[k]=fn},scrollIntoView(){this.scrolled=true}});return elements.get(id)}
const sandbox={document:{getElementById:el,createElement:()=>({textContent:"",className:"",attributes:{},children:[],listeners:{},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,fn){this.listeners[k]=fn},append(...x){this.children.push(...x)}})}};vm.createContext(sandbox);vm.runInContext(js,sandbox);const run=s=>vm.runInContext(s,sandbox);
const checks=[
["standalone HTML",/^<!doctype html>/i.test(html)],
["phase 30.8",html.includes("Phase 30.8")],
["next step hint",html.includes('id="progressHint"')],
["hint accessible",html.includes('id="progressHint" class="progress-hint" aria-live="polite"')],
["hint styling",html.includes(".progress-hint{")],
["hint mobile styling",html.includes("@media(max-width:400px){.progress-hint")],
["step choices",html.includes("const progressChoices=")],
["stylist explicit choice",html.includes("progressChoices.stylist=true")],
["preferences explicit choice",html.includes("progressChoices.preferences=true")],
["stylist reset",html.includes("progressChoices.stylist=false")],
["preferences reset",html.includes("progressChoices.preferences=false")],
["progress track accessible",html.includes('role="progressbar"')],
["service cards retained",html.includes("service-card")],
["salon profile retained",html.includes('class="salon-profile"')],
["gallery retained",html.includes('class="salon-gallery"')],
["barber retained",html.includes('id="stylists"')],
["date retained",html.includes('id="dates"')],
["times retained",html.includes('id="times"')],
["customer details retained",html.includes('id="customerName"')],
["preferences retained",html.includes('id="visitType"')],
["notes retained",html.includes('id="bookingNotes"')],
["confirmation retained",html.includes('id="confirmationDetails"')],
["reset retained",html.includes('id="startAgain"')],
["no external image",!/<img[^>]+src=["']https?:/i.test(html)],
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
["reduced motion",html.includes("prefers-reduced-motion")]
];for(const [name,ok] of checks)test(name,()=>assert.equal(ok,true));
test("JS compiles",()=>new vm.Script(js));
test("starts at zero",()=>assert.equal(run("progressCount()"),0));
test("initial guidance",()=>assert.equal(el("progressHint").textContent,"Start by choosing a service."));
test("initial progress accessibility",()=>assert.equal(el("progressTrack").attributes["aria-valuenow"],"0"));
test("service selection",()=>{el("services").children[0].listeners.click();assert.equal(run("progressCount()"),1)});
test("barber guidance",()=>assert.match(el("progressHint").textContent,/choose a barber/));
test("barber explicit choice",()=>{run('chooseStylist("any")');assert.equal(run("progressCount()"),2)});
test("date guidance",()=>assert.match(el("progressHint").textContent,/choose a date/));
test("date selection alone incomplete",()=>{el("dates").children[0].listeners.click();assert.equal(run("progressCount()"),2)});
test("date and time complete",()=>{el("times").children[0].listeners.click();assert.equal(run("progressCount()"),3)});
test("customer details guidance",()=>assert.match(el("progressHint").textContent,/valid email/));
test("customer details complete",()=>{el("customerName").value="Demo Person";el("customerEmail").value="demo@example.test";el("customerEmail").listeners.input();assert.equal(run("progressCount()"),4)});
test("preferences guidance",()=>assert.match(el("progressHint").textContent,/visit preferences/));
test("preferences remain optional for confirmation",()=>assert.equal(run("canPreview()"),true));
test("preferences completion on interaction",()=>{el("visitType").listeners.change();assert.equal(run("progressCount()"),5)});
test("all steps guidance",()=>assert.match(el("progressHint").textContent,/All five steps complete/));
test("progress fill complete",()=>assert.equal(el("progressFill").style.width,"100%"));
test("preview confirmation",()=>assert.equal(run("showConfirmation()"),true));
test("reset clears progress",()=>{run("startAnotherDemo()");assert.equal(run("progressCount()"),0)});
test("reset restores guidance",()=>assert.equal(el("progressHint").textContent,"Start by choosing a service."));
test("reset clears confirmation",()=>assert.equal(el("confirmation").hidden,true));
test("no preference can be reselected",()=>{run('chooseStylist("any")');assert.equal(run("progressCount()"),1)});
test("no service remains incomplete",()=>assert.equal(run("nextIncompleteStep().id"),"service"));
test("progress navigation",()=>{assert.equal(run('navigateToStep("details")'),true);assert.equal(el("step-details").scrolled,true)});
test("invalid navigation",()=>assert.equal(run('navigateToStep("unknown")'),false));
