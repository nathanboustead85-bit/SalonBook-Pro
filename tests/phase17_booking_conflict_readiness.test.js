"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.join(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const engineSource=read("functions/bookingEngine.js");
const trustedSource=read("functions/trustedBooking.js");
const backendSource=read("functions/index.js");
const rules=read("firestore.rules");
const website=read("website/book/index.html");
const moduleStub={exports:{}};
vm.runInNewContext(engineSource,{
 module:moduleStub,exports:moduleStub.exports,
 require:id=>{if(id==="firebase-admin/firestore")return {FieldValue:{serverTimestamp:()=>({})}};throw Error("Unexpected dependency: "+id);},
 Date,Intl,Error,Number,String,Array,Math,Set,RegExp,Object,Boolean
},{filename:"bookingEngine.js"});
const engine=moduleStub.exports;

test("Phase 17 trusted booking conflict safety (offline, no Firebase)",async t=>{
 await t.test("Overlapping appointments share 15-minute staff/date locks",()=>{
  const a=Array.from(engine.createLockIds("stylist","2026-12-15",540,600));
  const b=Array.from(engine.createLockIds("stylist","2026-12-15",570,630));
  const next=Array.from(engine.createLockIds("stylist","2026-12-15",600,630));
  const other=Array.from(engine.createLockIds("other","2026-12-15",570,630));
  assert.equal(a.length,4);
  assert.ok(a.some(id=>b.includes(id)),"Overlapping times must share a lock");
  assert.ok(!a.some(id=>next.includes(id)),"Adjacent slots must not collide");
  assert.ok(!a.some(id=>other.includes(id)),"Separate staff must have distinct locks");
 });
 await t.test("Invalid booking input is rejected before database operations",()=>{
  const base={businessId:"owner",serviceId:"cut",staffId:"stylist",date:"2026-12-15",startTime:"09:00",customerName:"Example Guest",customerEmail:"guest@example.test",customerPhone:""};
  for(const patch of [{startTime:"09:07"},{date:"2026-02-30"},{customerEmail:"not-an-email"},{staffId:"../escape"},{customerName:" "}])
   assert.throws(()=>engine.validateRequest({...base,...patch}),{code:"invalid-booking"});
 });
 await t.test("Existing lock rejects transaction without appointment writes",async()=>{
  const date=new Date();date.setDate(date.getDate()+14);
  const day=new Intl.DateTimeFormat("en-US",{weekday:"long",timeZone:"UTC"}).format(date).toLowerCase();
  const dateString=date.toISOString().slice(0,10);
  const member={id:"stylist",name:"Stylist",active:true,serviceIds:["cut"],weeklySchedule:{[day]:{open:"08:00",close:"18:00"}}};
  const catalogue={business:{ownerUid:"owner",published:true,acceptingBookings:true},services:[{id:"cut",name:"Cut",active:true,durationMinutes:30,price:20}],staff:[member]};
  let writes=0,reads=0;
  const ref={collection:()=>ref,doc:()=>ref};
  const db={collection:()=>ref,runTransaction:async callback=>callback({
    get:async()=>{reads++;return {exists:true};},
    create:()=>{writes++;}
  })};
  await assert.rejects(engine.createBooking({db,catalogue,request:{businessId:"owner",serviceId:"cut",staffId:"stylist",date:dateString,startTime:"09:00",customerName:"Example Guest",customerEmail:"guest@example.test",customerPhone:""}}),/already booked/);
  assert.ok(reads>0);
  assert.equal(writes,0,"Conflict must never create appointments or locks");
 });
 await t.test("Booking remains inaccessible to customers",()=>{
  assert.match(trustedSource,/publicBusiness\.acceptingBookings !== true/);
  assert.match(trustedSource,/catalogue\.business\.acceptingBookings !== true/);
  assert.match(engineSource,/snapshots\.some\([\s\S]*?snapshot => snapshot\.exists/);
  assert.match(engineSource,/transaction\.create\(\s*appointmentRef/);
  assert.match(engineSource,/transaction\.create\(ref,/);
  assert.doesNotMatch(backendSource,/exports\.(?:createBooking|createTrustedBooking|reserveSlot|confirmBooking)\s*=/);
  assert.match(rules,/match \/businesses\/\{businessId\}\/bookingLocks\/\{lockId\} \{\s*allow read, write: if false;/);
  assert.match(website,/Booking unavailable[^<]*preview only<\/button>/);
 });
});
