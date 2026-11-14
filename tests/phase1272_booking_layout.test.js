"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const html=fs.readFileSync("web/phase1272/index.html","utf8");
function check(label,fn){fn();console.log("PASS "+label)}
const script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
check("inline script parses",()=>{assert.equal(script.length,7);for(const item of script)if(item[1].trim())new vm.Script(item[1])});
for(const [label,fragment] of [["salon hero highlights",'class="salon-hero-highlights"'],["salon hero label",'Personal styling'],["journey introduction",'class="journey-intro"'],["journey heading",'A little time for you.'],["journey first step",'Pick your treatment'],["journey second step",'Find your time'],["journey third step",'Review your visit'],["mobile milestones",'@media(max-width:480px)'],["fictional disclaimer",'Fictional preview only · No real booking or payment'],["service cards",'id="serviceCards"'],["stylist cards",'id="stylistCards"'],["calendar",'id="calendar"'],["customer preview",'id="customerPreviewHeading"'],["review",'Your booking summary'],["fictional confirmation",'DEMONSTRATION ONLY · NO REAL APPOINTMENT'],["accessibility",'aria-labelledby="journeyIntroTitle"'],["three milestones",'aria-label="Three steps to preview an appointment"']])check(label,()=>assert.ok(html.includes(fragment),label));
check("journey appears before booking flow",()=>assert.ok(html.indexOf('class="journey-intro"')<html.indexOf('id="bookingFlow"')));
check("no external writes or data collection",()=>{for(const bad of ["fetch(","XMLHttpRequest","localStorage","sessionStorage","firebase.initializeApp","<form","WebSocket(","sendBeacon(","indexedDB","stripe.confirmPayment","paypal.Buttons"])assert.ok(!html.includes(bad),bad)});
