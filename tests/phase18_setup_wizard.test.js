"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
test("Phase 18.4 five-step wizard is safe and preview-only",async t=>{
 const html=read("website/business/setup/index.html");
 const js=read("website/business/setup/wizard.mjs");
 const m=await import(pathToFileURL(path.join(root,"website/business/setup/wizard.mjs")).href);
 const d={name:"Kody Blends",category:"barber",contact:"owner@example.com",service:"Haircut",price:"20.00",duration:"30",opening:"09:00",closing:"17:00",staff:"Kody"};
 await t.test("Five accessible screens and navigation are present",()=>{
  assert.deepEqual(m.STEPS,["Business","Services","Hours","Staff","Review"]);
  for(let i=0;i<5;i++)assert.match(html,new RegExp('data-step="'+i+'"'));
  for(const id of ["name","category","contact","service","price","duration","opening","closing","staff","review","back","next"])assert.ok(html.includes('id="'+id+'"'));
  assert.match(html,/aria-live="polite"/);
 });
 await t.test("Valid details pass, invalid details block progression",()=>{
  for(let i=0;i<5;i++)assert.equal(m.validateStep(i,d),true);
  assert.equal(m.validateStep(0,{...d,category:"admin"}),false);
  assert.equal(m.validateStep(0,{...d,contact:"invalid"}),false);
  assert.equal(m.validateStep(1,{...d,price:"-2"}),false);
  assert.equal(m.validateStep(1,{...d,duration:"999"}),false);
  assert.equal(m.validateStep(2,{...d,opening:"18:00",closing:"09:00"}),false);
  assert.equal(m.validateStep(3,{...d,staff:""}),false);
 });
 await t.test("No account creation, persistence, publishing or booking",()=>{
  assert.equal(m.SETUP_PUBLISHING_ENABLED,false);
  assert.equal(m.CUSTOMER_BOOKINGS_ENABLED,false);
  assert.match(html,/Development preview only/);
  assert.match(js,/form\.addEventListener\("submit",e=>e\.preventDefault\(\)\)/);
  assert.doesNotMatch(js,/\bfetch\s*\(|localStorage|sessionStorage|indexedDB|createUserWithEmailAndPassword|setDoc\s*\(/);
  assert.doesNotMatch(html,/<button[^>]*type="submit"|<form[^>]*action=/);
  assert.match(m.safeReview(d),/Bookings: Disabled/);
 });
});
