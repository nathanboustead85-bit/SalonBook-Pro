"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const {mapOpeningHours:map,adaptOpeningHoursDashboard:adapt,DAYS}=require("../web/phase33/opening-hours-33-4");
const now=1800000000000,context={ownerId:"owner",now};
const wrap=x=>({schemaVersion:1,json:JSON.stringify(x)});
const hours=()=>({schemaVersion:1,days:Object.fromEntries(DAYS.map(d=>[d,d==="sunday"?{closed:true}:{closed:false,intervals:[{open:"09:00",close:"17:00"}]}]))});
const input=()=>({auth:{uid:"owner",emailVerified:true},business:{businessId:"owner",name:"Kody Blends",acceptingBookings:false},expiresAt:now+1000,revision:4,servicesOwnerId:"owner",servicesRevision:4,staffOwnerId:"owner",staffRevision:4,hoursOwnerId:"owner",hoursRevision:4,services:wrap([{id:"cut",name:"Haircut",price:"20.00",duration:30,publicVisible:true}]),staff:wrap([{id:"alex",name:"Alex",role:"Stylist",serviceIds:["cut"],publicVisible:true,weeklySchedule:{monday:{open:"09:00",close:"17:00"}},weeklyBreaks:[],timeOff:[]}]),openingHours:hours()});
test("closed Sundays and valid opening hours map to immutable read-only days",()=>{const x=map(hours());assert.equal(x.status,"HOURS_READ_ONLY_PREVIEW");assert.equal(x.openingHours.length,7);assert.equal(x.openingHours[6].closed,true);assert.equal(x.openingHours[6].intervals.length,0);assert(Object.isFrozen(x.openingHours[0].intervals[0]))});
test("split shift intervals allowed",()=>{const x=hours();x.days.monday.intervals=[{open:"09:00",close:"12:00"},{open:"13:00",close:"17:00"}];assert.equal(map(x).status,"HOURS_READ_ONLY_PREVIEW")});
test("adjacent intervals allowed",()=>{const x=hours();x.days.monday.intervals=[{open:"09:00",close:"12:00"},{open:"12:00",close:"17:00"}];assert.equal(map(x).status,"HOURS_READ_ONLY_PREVIEW")});
for(const [label,mutate] of [
 ["missing day",x=>delete x.days.sunday],["unknown day",x=>x.days.funday={closed:true}],["closed day with hours",x=>x.days.sunday.intervals=[]],["invalid closed flag",x=>x.days.monday.closed="no"],["no intervals",x=>x.days.monday.intervals=[]],["bad time",x=>x.days.monday.intervals[0].open="25:00"],["reversed hours",x=>x.days.monday.intervals[0].close="08:00"],["zero duration",x=>x.days.monday.intervals[0].close="09:00"],["unexpected field",x=>x.days.monday.extra="yes"],["overlap",x=>x.days.monday.intervals.push({open:"16:00",close:"18:00"})]
])test(label+" fails closed",()=>{const x=hours();mutate(x);assert.equal(map(x).status,"UNAVAILABLE")});
test("integrated staff, services and hours read-only display",()=>{const x=adapt(input(),context);assert.equal(x.status,"READ_ONLY_READY");assert.equal(x.bookingEnabled,false);assert.equal(x.editingEnabled,false);assert.equal(x.availabilityStatus,"UNVERIFIED_READ_ONLY");assert.equal(x.staff.length,1);assert.equal(x.services.length,1);assert.equal(x.openingHours.length,7)});
test("cross-owner hours rejected",()=>{const x=input();x.hoursOwnerId="other";assert.equal(adapt(x,context).status,"UNAVAILABLE")});
test("stale hours revision rejected",()=>{const x=input();x.hoursRevision=3;assert.equal(adapt(x,context).status,"UNAVAILABLE")});
test("stale owner snapshot rejected",()=>{const x=input();x.expiresAt=now-1;assert.equal(adapt(x,context).status,"UNAVAILABLE")});
test("missing hours unavailable, not guessed",()=>{const x=input();delete x.openingHours;assert.equal(adapt(x,context).status,"UNAVAILABLE")});
test("loading state preserved",()=>assert.equal(adapt({loading:true},context).status,"LOADING"));
test("original input not mutated",()=>{const x=input(),before=JSON.stringify(x);adapt(x,context);assert.equal(JSON.stringify(x),before)});
test("no network, writes, persistence or deployment",()=>{const s=fs.readFileSync(require.resolve("../web/phase33/opening-hours-33-4"),"utf8");assert.doesNotMatch(s,/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|\.setDoc\s*\(|\.updateDoc\s*\(|deploy\s*\(/i)});
