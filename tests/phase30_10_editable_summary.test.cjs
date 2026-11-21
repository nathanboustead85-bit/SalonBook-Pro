"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"../web/phase30/booking-30-10.html"),"utf8"),js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
const elements=new Map();function el(id){if(!elements.has(id))elements.set(id,{value:id==="visitType"?"regular":"",textContent:"",hidden:true,disabled:true,style:{},attributes:{},children:[],listeners:{},replaceChildren(){this.children=[]},append(...x){this.children.push(...x)},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,fn){this.listeners[k]=fn},scrollIntoView(){this.scrolled=true}});return elements.get(id)}
const sandbox={document:{getElementById:el,createElement:()=>({textContent:"",className:"",attributes:{},children:[],listeners:{},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,fn){this.listeners[k]=fn},append(...x){this.children.push(...x)}})}};vm.createContext(sandbox);vm.runInContext(js,sandbox);const run=s=>vm.runInContext(s,sandbox);
const checks=[
["standalone HTML",/^<!doctype html>/i.test(html)],["phase 30.10",html.includes("Phase 30.10")],
["summary edit grid",html.includes('class="summary-edit-grid"')],["summary edit aria",html.includes('aria-label="Edit booking sections"')],
["service edit",html.includes('id="editService"')],["barber edit",html.includes('id="editStylist"')],
["date edit",html.includes('id="editDate"')],["details edit",html.includes('id="editDetails"')],
["preferences edit",html.includes('id="editPreferences"')],["edit feedback",html.includes('id="editFeedback"')],
["edit feedback live",html.includes('role="status" aria-live="polite"')],["edit function",html.includes("function editBookingStep(id)")],
["edit styles",html.includes(".summary-edit-grid{")],["focus styles",html.includes(".summary-edit:focus-visible")],
["mobile styles",html.includes("@media(max-width:360px){.summary-edit-grid")],
["service cards retained",html.includes("service-card")],["salon profile retained",html.includes('class="salon-profile"')],
["gallery retained",html.includes('class="salon-gallery"')],["progress retained",html.includes('id="progressSteps"')],
["barber retained",html.includes('id="stylists"')],["date retained",html.includes('id="dates"')],
["times retained",html.includes('id="times"')],["customer details retained",html.includes('id="customerName"')],
["preferences retained",html.includes('id="visitType"')],["notes retained",html.includes('id="bookingNotes"')],
["confirmation retained",html.includes('id="confirmationDetails"')],["reset retained",html.includes('id="startAgain"')],
["name validation retained",html.includes('id="nameHelp"')],["email validation retained",html.includes('id="emailHelp"')],
["readiness retained",html.includes('id="bookingReadiness"')],["no remote image",!/<img[^>]+src=["']https?:/i.test(html)],
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
test("edit service scrolls",()=>{el("editService").listeners.click();assert.equal(el("step-service").scrolled,true)});
test("edit barber scrolls",()=>{el("editStylist").listeners.click();assert.equal(el("step-stylist").scrolled,true)});
test("edit date scrolls",()=>{el("editDate").listeners.click();assert.equal(el("step-date").scrolled,true)});
test("edit details scrolls",()=>{el("editDetails").listeners.click();assert.equal(el("step-details").scrolled,true)});
test("edit preferences scrolls",()=>{el("editPreferences").listeners.click();assert.equal(el("step-preferences").scrolled,true)});
test("edit feedback describes section",()=>assert.match(el("editFeedback").textContent,/preferences/));
test("invalid edit rejected",()=>assert.equal(run('editBookingStep("nonexistent")'),false));
test("service selection preserved through edit",()=>{el("services").children[0].listeners.click();el("editDetails").listeners.click();assert.equal(run("state.service"),"cut")});
test("date selection preserved through edit",()=>{el("dates").children[0].listeners.click();el("times").children[0].listeners.click();el("editService").listeners.click();assert.equal(run("state.date"),"d1")});
test("time preserved through edit",()=>assert.equal(run("state.time"),"09:00"));
test("barber preserved through edit",()=>{run('chooseStylist("sam")');el("editPreferences").listeners.click();assert.equal(run("state.stylist"),"sam")});
test("customer details preserved through edit",()=>{el("customerName").value="Demo Person";el("customerEmail").value="demo@example.test";el("customerEmail").listeners.input();el("editDate").listeners.click();assert.equal(el("customerName").value,"Demo Person")});
test("confirmation available after edits",()=>assert.equal(run("canPreview()"),true));
test("confirmation renders",()=>assert.equal(run("showConfirmation()"),true));
test("edit doesn't hide confirmation on its own",()=>{el("editService").listeners.click();assert.equal(el("confirmation").hidden,false)});
test("changing service clears old confirmation",()=>{el("services").children[1].listeners.click();assert.equal(el("confirmation").hidden,true)});
test("reset clears edit feedback",()=>{run("startAnotherDemo()");assert.equal(el("editFeedback").textContent,"Your choices are kept while you make changes.")});
test("reset clears service",()=>assert.equal(run("state.service"),null));
test("reset clears progress",()=>assert.equal(run("progressCount()"),0));
test("reset clears details",()=>assert.equal(el("customerName").value,""));
