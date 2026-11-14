"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const html=fs.readFileSync("web/phase1273/index.html","utf8");
function check(label,fn){fn();console.log("PASS "+label)}
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
check("inline script parses",()=>{assert.equal(scripts.length,7);for(const s of scripts)if(s[1].trim())new vm.Script(s[1])});
for(const [label,fragment] of [["reassurance section",'class="booking-reassurance"'],["reassurance heading",'Simple, clear booking'],["stylist reassurance",'Choose your stylist'],["availability reassurance",'See available times'],["review reassurance",'Review before confirming'],["read-only disclaimer",'No real appointment, payment or customer information is submitted.'],["mobile layout",'.reassurance-points{display:grid;grid-template-columns:1fr}'],["accessible label",'aria-label="Booking preview information"'],["salon header",'id="salonTitle"'],["premium introduction",'A little time for you.'],["service cards",'id="serviceCards"'],["stylist cards",'id="stylistCards"'],["calendar",'id="calendar"'],["customer preview",'id="customerPreviewHeading"'],["booking summary",'Your booking summary'],["fictional confirmation",'DEMONSTRATION ONLY · NO REAL APPOINTMENT']])check(label,()=>assert.ok(html.includes(fragment),label));
check("reassurance precedes booking",()=>assert.ok(html.indexOf('class="booking-reassurance"')<html.indexOf('id="bookingFlow"')));
check("no network or persistent writes",()=>{for(const bad of ["fetch(","XMLHttpRequest","localStorage","sessionStorage","firebase.initializeApp","<form","WebSocket(","sendBeacon(","indexedDB","stripe.confirmPayment","paypal.Buttons"])assert.ok(!html.includes(bad),bad)});
