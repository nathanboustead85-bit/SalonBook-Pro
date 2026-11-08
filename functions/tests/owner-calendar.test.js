"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { getOwnerCalendar } = require("../ownerCalendar");
const date = "2026-11-18";
const request = { auth: { uid:"owner1", token:{email_verified:true} }, data:{businessId:"other"} };
function fakeDb(docs) {
  return { collection(name) {
    assert.equal(name,"businesses");
    return { doc(uid) {
      assert.equal(uid,"owner1");
      return { collection(kind) {
        assert.equal(kind,"appointments");
        return { where(field,op,value) {
          assert.deepEqual([field,op,value],["date","==",date]);
          return { async get(){return {docs:docs.map((x,i)=>({id:"appointment"+i,data:()=>x}))}} };
        }};
      }};
    }};
  }};
}
const item = {businessId:"owner1",date,startTime:"10:00",endTime:"10:30",
  staffId:"alex",staffName:"Alex",serviceId:"cut",serviceName:"Cut",
  customerName:"Customer",status:"confirmed",source:"online"};
test("verified owner reads shared appointments",async()=>{
  const result=await getOwnerCalendar({db:fakeDb([item]),request,date});
  assert.equal(result.appointments.length,1);
  assert.equal(result.appointments[0].source,"online");
});
test("business ID injection cannot change tenant",async()=>{
  const result=await getOwnerCalendar({db:fakeDb([item]),request,date});
  assert.equal(result.appointments[0].customerName,"Customer");
});
test("unverified user is denied",async()=>{
  await assert.rejects(getOwnerCalendar({db:fakeDb([item]),
    request:{auth:{uid:"owner1",token:{email_verified:false}}},date}),/Verified/);
});
test("unauthenticated user is denied",async()=>{
  await assert.rejects(getOwnerCalendar({db:fakeDb([item]),request:{},date}),/Verified/);
});
test("cross-business data fails closed",async()=>{
  await assert.rejects(getOwnerCalendar({db:fakeDb([{...item,businessId:"other"}]),request,date}),/ownership mismatch/);
});
test("cancelled appointments are hidden",async()=>{
  const result=await getOwnerCalendar({db:fakeDb([{...item,status:"cancelled"}]),request,date});
  assert.equal(result.appointments.length,0);
});
test("invalid calendar dates are rejected",async()=>{
  await assert.rejects(getOwnerCalendar({db:fakeDb([]),request,date:"2026-02-30"}),/Invalid calendar date/);
});
