"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const {mapStaff,adaptStaffDashboard}=require("../web/phase33/staff-map-33-3");
const now=1800000000000,context={ownerId:"owner",now};
const wrap=x=>({schemaVersion:1,json:JSON.stringify(x)});
const person=()=>({id:"alex",name:"Alex",role:"Stylist",serviceIds:["cut"],publicVisible:true,weeklySchedule:{monday:{open:"09:00",close:"17:00"}},weeklyBreaks:[{id:"break1",day:"monday",start:"12:00",end:"12:30",reason:"Lunch"}],timeOff:[{id:"leave1",date:"2026-11-23",start:"09:00",end:"17:00",reason:"Holiday"}]});
const service=()=>({id:"cut",name:"Haircut",price:"20.00",duration:30,publicVisible:true});
const base=()=>({auth:{uid:"owner",emailVerified:true},business:{businessId:"owner",name:"Kody Blends",acceptingBookings:false},expiresAt:now+1000,revision:4,servicesOwnerId:"owner",servicesRevision:4,staffOwnerId:"owner",staffRevision:4,services:wrap([service()]),staff:wrap([person()])});
test("valid staff and service mapping is immutable and read only",()=>{const x=adaptStaffDashboard(base(),context);assert.equal(x.status,"READ_ONLY_READY");assert.equal(x.staff[0].role,"Stylist");assert.equal(x.staff[0].weeklySchedule.monday.open,"09:00");assert.equal(x.staff[0].timeOff[0].date,"2026-11-23");assert.equal(x.bookingEnabled,false);assert(Object.isFrozen(x.staff[0]))});
test("private staff stays private",()=>{const x=person();x.publicVisible=false;assert.equal(mapStaff(wrap([x]),[{id:"cut"}]).staff[0].publicVisible,false)});
test("missing visibility defaults private",()=>{const x=person();delete x.publicVisible;assert.equal(mapStaff(wrap([x]),[{id:"cut"}]).staff[0].publicVisible,false)});
for(const [label,mutate] of [
 ["unknown service",x=>x.serviceIds=["unknown"]],["duplicate service",x=>x.serviceIds=["cut","cut"]],["blank name",x=>x.name=""],["invalid role",x=>x.role=7],["invalid time",x=>x.weeklySchedule.monday.open="99:00"],["reversed hours",x=>x.weeklySchedule.monday.close="08:00"],["unknown day",x=>x.weeklySchedule.funday={open:"09:00",close:"10:00"}],["break outside shift",x=>x.weeklyBreaks[0].start="08:00"],["invalid holiday date",x=>x.timeOff[0].date="2026-02-30"],["invalid holiday range",x=>x.timeOff[0].end="08:00"],["invalid visibility",x=>x.publicVisible="yes"]
])test(label+" fails closed",()=>{const x=person();mutate(x);assert.equal(mapStaff(wrap([x]),[{id:"cut"}]).status,"UNAVAILABLE")});
test("duplicate staff IDs rejected",()=>assert.equal(mapStaff(wrap([person(),person()]),[{id:"cut"}]).status,"UNAVAILABLE"));
test("overlapping breaks rejected",()=>{const x=person();x.weeklyBreaks.push({id:"break2",day:"monday",start:"12:15",end:"13:00"});assert.equal(mapStaff(wrap([x]),[{id:"cut"}]).status,"UNAVAILABLE")});
test("malformed JSON rejected",()=>assert.equal(mapStaff({schemaVersion:1,json:"{"},[{id:"cut"}]).status,"UNAVAILABLE"));
test("staff owner mismatch rejected",()=>{const x=base();x.staffOwnerId="foreign";assert.equal(adaptStaffDashboard(x,context).status,"UNAVAILABLE")});
test("staff revision mismatch rejected",()=>{const x=base();x.staffRevision=3;assert.equal(adaptStaffDashboard(x,context).status,"UNAVAILABLE")});
test("stale business snapshot rejected",()=>{const x=base();x.expiresAt=now-1;assert.equal(adaptStaffDashboard(x,context).status,"UNAVAILABLE")});
test("loading state preserved",()=>assert.equal(adaptStaffDashboard({loading:true},context).status,"LOADING"));
test("source unchanged",()=>{const x=base(),before=JSON.stringify(x);adaptStaffDashboard(x,context);assert.equal(JSON.stringify(x),before)});
test("no network, storage or write APIs",()=>{const s=fs.readFileSync(require.resolve("../web/phase33/staff-map-33-3"),"utf8");assert.doesNotMatch(s,/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|\.setDoc\s*\(|\.updateDoc\s*\(|deploy\s*\(/i)});
