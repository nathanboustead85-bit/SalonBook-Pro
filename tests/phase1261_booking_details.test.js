"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const html=fs.readFileSync("web/phase1261/index.html","utf8");
const test=(name,fn)=>{fn();console.log("PASS "+name)};
test("page scripts parse",()=>{const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,7);for(const s of scripts)if(s[1].trim())new vm.Script(s[1])});
for(const [name,fragment] of [
["final review title","Review your appointment details"],["review step label","Step 3 · Final review · Demo only"],
["review accessibility","Final fictional appointment review"],["review details","data.serviceName"],["review stylist","data.staffName"],
["review date","data.date"],["review start time","data.time"],["review end time","data.end"],["review duration","data.durationMinutes"],
["price breakdown","Price breakdown"],["price aria label","Fictional price breakdown"],["service price","money(data.pricePence)"],
["zero additional fees",'["Additional fees",money(0)]'],["total clarity","Total shown · no payment"],
["price precision",'toFixed(2)'],["illustrative pricing","Prices are illustrative"],["no payment","No payment is collected"],
["no customer submission","no customer details are submitted"],["change time button","Change date or time"],
["change time resets review","result.replaceChildren();updateProgress()"],["change time feedback","Choose another fictional time"],
["confirmation preview","Preview confirmation (no booking)"],["reschedule preview","Preview reschedule (no booking)"],
["read-only name","Demo Customer"],["read-only email","demo@example.invalid"],["read-only fields","input.readOnly=true"],
["dashboard","Manage your appointments"],["cancel action","cancelDemo(index)"],["reschedule action","startReschedule(index)"],
["booking progress","Booking progress"],["responsive price section",".price-breakdown"],["accessible buttons","min-height:48px"],
["no indexing","noindex,nofollow"],["read only demo","Fictional preview only · No real booking or payment"]
])test(name,()=>assert.ok(html.includes(fragment),name));
test("no server writes, requests, storage, editable forms or payment SDK",()=>{for(const bad of ["fetch(","XMLHttpRequest","localStorage","sessionStorage","firebase.initializeApp","<form","WebSocket(","sendBeacon(","indexedDB","stripe.confirmPayment","paypal.Buttons"])assert.ok(!html.includes(bad),bad)});
test("review price derived from service, not user input",()=>assert.ok(html.includes('money(data.pricePence)')));
test("no duplicate demo appointment safety preserved",()=>assert.ok(html.includes("Demo conflict")&&html.includes("reservations.simulate")));
const m=require("../web/phase1258/managementPreview");
test("cancellation does not mutate source holds",()=>{const holds=[{date:"2026-11-23",staffId:"sam",start:840,end:870}];const response=m.cancel({holds,index:0});assert.equal(response.holds.length,0);assert.equal(holds.length,1)});
