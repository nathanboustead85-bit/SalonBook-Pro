"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
test("Phase 18.8 premium dashboard offline safety",async t=>{
 const m=await import(pathToFileURL(path.join(root,"website/business/dashboard/dashboard.mjs")).href);
 const html=read("website/business/dashboard/index.html");
 const view=read("website/business/dashboard/view.mjs");
 await t.test("Dashboard is preview-only with all booking gates disabled",()=>{
  assert.equal(m.DASHBOARD_PREVIEW_ONLY,true);
  assert.equal(m.PUBLIC_REGISTRATION_ENABLED,false);
  assert.equal(m.CUSTOMER_BOOKINGS_ENABLED,false);
  assert.equal(m.dashboardModel().bookingStatus,"Disabled");
  assert.equal(m.dashboardModel().registrationStatus,"Disabled");
  assert.equal(m.dashboardModel().publishingStatus,"Disabled");
  assert.match(html,/Development preview only/);
  assert.match(html,/demonstration data/);
 });
 await t.test("Overview, setup progress, services, staff and working hours are modeled",()=>{
  const model=m.dashboardModel();
  assert.equal(model.progress,100);
  assert.equal(model.services.length,2);
  assert.equal(model.staff.length,2);
  assert.equal(Object.keys(model.hours).length,7);
  assert.deepEqual(model.checks,[true,true,true,true]);
  assert.equal(m.dashboardModel({...m.DEMO,services:[]}).progress,75);
  assert.equal(m.dashboardModel({...m.DEMO,staff:[]}).progress,75);
 });
 await t.test("All six dashboard sections and account/booking indicators are present",()=>{
  for(const id of ["overview","services","staff","hours","account","booking"]){
   assert.match(html,new RegExp('id="'+id+'"'));
   assert.match(html,new RegExp('data-target="'+id+'"'));
  }
  for(const phrase of ["Setup progress","Booking settings","Public registration","Business publishing","Disabled","Account"])assert.ok(html.includes(phrase),phrase);
  assert.match(html,/aria-label="Dashboard sections"/);
  assert.match(html,/role="progressbar"/);
 });
 await t.test("Dashboard uses safe text rendering, with no data access or persistence",()=>{
  assert.match(view,/\.textContent=/);
  assert.doesNotMatch(view,/innerHTML|outerHTML|insertAdjacentHTML/);
  for(const code of [view,read("website/business/dashboard/dashboard.mjs"),html]){
   assert.doesNotMatch(code,/\bfetch\s*\(|localStorage|sessionStorage|indexedDB|firebase\/|setDoc\s*\(|addDoc\s*\(|<form\b/);
  }
  assert.match(html,/noindex,nofollow/);
  assert.doesNotMatch(html,/type="submit"/);
 });
});
