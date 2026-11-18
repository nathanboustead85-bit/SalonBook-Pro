"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
test("Phase 18.5 enhanced offline setup",async t=>{
 const m=await import(pathToFileURL(path.join(root,"website/business/setup/enhanced-draft.mjs")).href);
 const html=read("website/business/setup/index.html");
 const js=read("website/business/setup/wizard.mjs");
 const d={name:"Kody Blends",category:"barber",contact:"owner@example.com",services:[{name:"Haircut",price:"20.00",duration:"30"},{name:"Beard trim",price:"8.50",duration:15}],staff:[{name:"Kody"},{name:"Alex"}],week:m.defaultWeek()};
 await t.test("Multiple services and staff are validated with limits",()=>{
  assert.equal(m.validateSetup(d),true);
  assert.equal(m.validateService({name:"Cut",price:"0.00",duration:30}),true);
  for(const price of ["-1","1.999","10000.01","Infinity",""])assert.equal(m.validateService({name:"Cut",price,duration:30}),false);
  assert.equal(m.validateSetup({...d,services:[]}),false);
  assert.equal(m.validateSetup({...d,staff:[]}),false);
  assert.equal(m.validateSetup({...d,services:Array(31).fill(d.services[0])}),false);
  assert.equal(m.validateSetup({...d,staff:Array(26).fill(d.staff[0])}),false);
 });
 await t.test("Seven-day hours reject overlaps, invalid time and fully closed week",()=>{
  assert.equal(m.DAYS.length,7);
  assert.equal(m.validateWeek(d.week),true);
  assert.equal(m.validateWeek({...d.week,Monday:{closed:false,open:"17:00",close:"09:00"}}),false);
  assert.equal(m.validateWeek({...d.week,Monday:{closed:false,open:"25:00",close:"26:00"}}),false);
  assert.equal(m.validateWeek(Object.fromEntries(m.DAYS.map(day=>[day,{closed:true,open:"09:00",close:"17:00"}]))),false);
 });
 await t.test("Review includes all services, staff and each weekday",()=>{
  const review=m.reviewLines(d).join("\n");
  for(const phrase of ["Haircut","Beard trim","Kody","Alex",...m.DAYS,"Customer bookings: Disabled","Publishing: Disabled"])assert.ok(review.includes(phrase),phrase);
  assert.throws(()=>m.reviewLines({...d,staff:[]}),/Complete/);
 });
 await t.test("Preview UI stays inert, no storage, Firebase or deployment",()=>{
  for(const id of ["add-service","services-list","add-staff","staff-list","weekly-hours"])assert.ok(html.includes('id="'+id+'"'));
  assert.match(js,/validateWeek\(week\)/);
  assert.match(js,/reviewLines\(/);
  assert.doesNotMatch(js,/\bfetch\s*\(|localStorage|sessionStorage|indexedDB|setDoc\s*\(/);
  assert.doesNotMatch(read("website/business/setup/enhanced-draft.mjs"),/\bfetch\s*\(|localStorage|sessionStorage|indexedDB|firebase/);
  assert.match(html,/Development preview only/);
  assert.doesNotMatch(html,/<button[^>]*type="submit"/);
 });
});
