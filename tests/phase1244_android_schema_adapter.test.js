"use strict";
const assert=require("node:assert/strict");
const {convert}=require("../functions/phase1244AndroidSchemaAdapter");
const profile={businessId:"demo-owner",name:"Demo Salon",slug:"demo-salon",
 published:true,acceptingBookings:false,schemaVersion:1};
const services=[{id:"cut",name:"Haircut",price:"20.00",duration:30,publicVisible:true},
 {id:"private",name:"Private treatment",price:"50",duration:60,publicVisible:false}];
const staff=[{id:"alex",name:"Alex",publicVisible:true,serviceIds:["cut"],
 weeklySchedule:{friday:{open:"09:00",close:"12:00"}},
 weeklyBreaks:[{day:"friday",start:"10:00",end:"10:30",reason:"PRIVATE BREAK"}],
 timeOff:[{date:"2026-11-20",start:"11:00",end:"11:30",reason:"PRIVATE REASON"}]}];
const bookings=[{id:"original-test",client:"PRIVATE CLIENT",notes:"SECRET NOTES",
 staffId:"alex",serviceId:"cut",date:"2026-11-20",time:"09:30",duration:30}];
const doc=a=>({json:JSON.stringify(a),schemaVersion:1,updatedAt:"not needed for pure test"});
const args={profile,servicesDoc:doc(services),staffDoc:doc(staff),
 bookingsDoc:doc(bookings),date:"2026-11-20",generatedAt:1000000};
function check(name,fn){fn();console.log("PASS "+name)}
check("Android v1 JSON documents map into public preview",()=>{
 const x=convert(args);assert.equal(x.status,"PUBLIC_PREVIEW");assert.equal(x.bookingEnabled,false);
 assert.equal(x.services.length,1);assert.equal(x.services[0].pricePence,2000);
});
check("private service excluded",()=>assert.equal(convert(args).services.some(s=>s.id==="private"),false));
check("legacy booking blocks occupied time",()=>{
 const x=convert(args);assert.equal(x.availability[0].times.includes("09:30"),false);
});
check("weekly break excludes unavailable time",()=>{
 const x=convert(args);assert.equal(x.availability[0].times.includes("10:00"),false);
});
check("date-specific time off excludes unavailable time",()=>{
 const x=convert(args);assert.equal(x.availability[0].times.includes("11:00"),false);
});
check("private client and staff reasons never exposed",()=>{
 const x=JSON.stringify(convert(args));
 for(const secret of ["PRIVATE CLIENT","SECRET NOTES","PRIVATE BREAK","PRIVATE REASON","customerName","weeklySchedule"])
  assert.equal(x.includes(secret),false,secret);
});
check("service must be explicitly public",()=>{
 const x=convert({...args,servicesDoc:doc(services.map(s=>({...s,publicVisible:false})))});
 assert.equal(x.status,"PUBLIC_PREVIEW");assert.equal(x.services.length,0);
});
check("staff must be explicitly public",()=>{
 const x=convert({...args,staffDoc:doc(staff.map(s=>({...s,publicVisible:false})))});
 assert.equal(x.status,"PUBLIC_PREVIEW");assert.equal(x.availability.length,0);
});
check("missing visibility flags fail closed",()=>{
 const s=[{id:"cut",name:"Haircut",price:"20",duration:30}];
 assert.equal(convert({...args,servicesDoc:doc(s)}).status,"NOT_PUBLISHABLE");
});
check("missing booking duration fails closed",()=>{
 assert.equal(convert({...args,bookingsDoc:doc([{staffId:"alex",date:"2026-11-20",time:"09:30"}])}).status,"NOT_PUBLISHABLE");
});
check("missing cloud data fails closed",()=>{
 assert.equal(convert({...args,bookingsDoc:null}).status,"NOT_PUBLISHABLE");
});
check("invalid JSON and schema rejected",()=>{
 assert.equal(convert({...args,servicesDoc:{json:"oops",schemaVersion:1}}).status,"NOT_PUBLISHABLE");
 assert.equal(convert({...args,staffDoc:{json:"[]",schemaVersion:2}}).status,"NOT_PUBLISHABLE");
});
check("unpublished profile denied",()=>{
 assert.equal(convert({...args,profile:{...profile,published:false}}).status,"NOT_PUBLISHABLE");
});
check("duplicate staff or service IDs denied",()=>{
 assert.equal(convert({...args,servicesDoc:doc([...services,services[0]])}).status,"NOT_PUBLISHABLE");
});
check("invalid price denied",()=>{
 assert.equal(convert({...args,servicesDoc:doc([{...services[0],price:"20abc"}])}).status,"NOT_PUBLISHABLE");
});
check("booking creation remains disabled",()=>assert.equal(convert(args).bookingEnabled,false));
