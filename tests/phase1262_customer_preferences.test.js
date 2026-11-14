"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const html=fs.readFileSync("web/phase1262/index.html","utf8");
const test=(name,fn)=>{fn();console.log("PASS "+name)};
test("all page scripts parse",()=>{const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,7);for(const s of scripts)if(s[1].trim())new vm.Script(s[1])});
for(const [name,fragment] of [
["preferences title","Booking preferences · fictional example"],["contact dropdown",'"demoContact"'],["contact label","Example contact preference"],["no messages default","No messages (demo default)"],["email preview","Email reminder preview (not sent)"],["sms preview","SMS reminder preview (not sent)"],
["note dropdown",'"demoNote"'],["no note default","No note"],["first visit","First visit (fictional example)"],["hairstyle consultation","Discuss hairstyle (fictional example)"],
["visit dropdown",'"demoAccess"'],["quiet preference","Quiet appointment (fictional example)"],["extra consultation","Extra consultation (fictional example)"],
["no preference default","No additional preference"],["select options only","Choose from example options only"],
["no real details","Do not enter real names, contact details or personal notes"],
["live preference summary",'summary.setAttribute("aria-live","polite")'],["live changes",'select.addEventListener("change",preferences)'],
["contact summary",'["Contact",contact]'],["note summary",'["Note",noteChoice]'],["visit summary",'["Visit",accessibility]'],
["no notifications","No emails or texts are sent"],["no storage","never stored or submitted"],["refresh privacy","disappear on refresh"],
["fictional contact name","Demo Customer"],["fictional email","demo@example.invalid"],["read only name and email","input.readOnly=true"],
["final review","Review your appointment details"],["price breakdown","Price breakdown"],["time change","Change date or time"],
["confirmation preview","Preview confirmation (no booking)"],["reschedule preview","Preview reschedule (no booking)"],
["management dashboard","Manage your appointments"],["cancellation preview","Cancel preview"],["booking progress","Booking progress"],
["fictional-only banner","Fictional preview only · No real booking or payment"],["no indexing","noindex,nofollow"],["mobile selects",".preferences select{min-height:48px}"]
])test(name,()=>assert.ok(html.includes(fragment),name));
test("no networking, storage, form submission or payment SDK",()=>{for(const bad of ["fetch(","XMLHttpRequest","localStorage","sessionStorage","firebase.initializeApp","<form","WebSocket(","sendBeacon(","indexedDB","stripe.confirmPayment","paypal.Buttons"])assert.ok(!html.includes(bad),bad)});
test("preferences are local to review and not included in reservation request",()=>{const req=html.slice(html.indexOf("const activeHolds="),html.indexOf("const panel=document.getElementById",html.indexOf("const activeHolds=")));for(const x of ["contact.value","noteChoice.value","accessibility.value","demoContact","demoNote","demoAccess"])assert.ok(!req.includes(x),x)});
test("only predefined select choices, no editable personal data",()=>assert.ok(html.includes("function presetSelect(")&&!html.includes('document.createElement("textarea")')));
test("existing reservation conflict guard retained",()=>assert.ok(html.includes("reservations.simulate")&&html.includes("Demo conflict")));
