"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const html=fs.readFileSync("web/phase1275/index.html","utf8");
function check(name,fn){fn();console.log("PASS "+name)}
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
check("inline script parses",()=>{assert.equal(scripts.length,7);for(const s of scripts)if(s[1].trim())new vm.Script(s[1])});
for(const [name,fragment] of [["selection summary",'class="selection-summary-frame"'],["accessible summary",'aria-labelledby="selectionSummaryHeading"'],["summary heading",'id="selectionSummaryHeading">Appointment at a glance'],["live selection",'id="mobileSelection"'],["safety footnote",'Nothing is reserved until a real booking system is introduced.'],["mobile styling",'@media(max-width:420px){.selection-summary-frame'],["review detail layout",'.review-card .detail{display:flex'],["review price card",'.review-card .price-breakdown{border:1px solid'],["total price style",'.review-card .price-total{font-size:19px'],["service cards",'id="serviceCards"'],["stylist cards",'id="stylistCards"'],["calendar",'id="calendar"'],["customer preview",'id="customerPreviewHeading"'],["booking summary",'Your booking summary'],["price breakdown",'Price breakdown'],["fictional confirmation",'DEMONSTRATION ONLY · NO REAL APPOINTMENT']])check(name,()=>assert.ok(html.includes(fragment),name));
check("selection summary before review button",()=>assert.ok(html.indexOf('class="selection-summary-frame"')<html.indexOf('id="review" disabled')));
check("selection summary before customer preview",()=>assert.ok(html.indexOf('class="selection-summary-frame"')<html.indexOf('class="customer-preview"')));
check("no network or persistent writes",()=>{for(const bad of ["fetch(","XMLHttpRequest","localStorage","sessionStorage","firebase.initializeApp","<form","WebSocket(","sendBeacon(","indexedDB","stripe.confirmPayment","paypal.Buttons"])assert.ok(!html.includes(bad),bad)});
