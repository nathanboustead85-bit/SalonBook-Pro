const {test}=require("node:test");
const assert=require("node:assert/strict");
const {authorize}=require("../security/employee-backend-preview.cjs");
const request={businessId:"b",bookingId:"a",action:"view"};
const fixture=()=>({
 identity:async()=>({uid:"e",verified:true}),
 membership:async()=>({businessId:"b",userId:"e",role:"EMPLOYEE",active:true,revision:1}),
 policy:async()=>({businessId:"b",userId:"e",membershipRevision:1,revision:1,grants:["OWN_APPOINTMENTS"]}),
 booking:async()=>({businessId:"b",id:"a",staffUserId:"e",revision:1,historical:false})
});
test("trusted identity and resource scope",async()=>{
 assert.equal(await authorize(request,fixture()),true);
 assert.equal(await authorize({...request,businessId:"other"},fixture()),false);
 assert.equal(await authorize({...request,bookingId:"other"},fixture()),false);
 assert.equal(await authorize(request,{...fixture(),identity:async()=>null}),false);
 assert.equal(await authorize(request,{...fixture(),identity:async()=>({uid:"e",verified:false})}),false);
 assert.equal(await authorize(request,{...fixture(),booking:async()=>({...await fixture().booking(),staffUserId:"other"})}),false);
});
test("request cannot grant itself access",async()=>{
 assert.equal(await authorize({...request,action:"contact",grants:["CUSTOMER_CONTACT"],role:"OWNER"},fixture()),false);
 assert.equal(await authorize({...request,action:"edit",expectedRevision:1},fixture()),false);
 assert.equal(await authorize(request,{...fixture(),policy:async()=>({...await fixture().policy(),grants:["FINANCES","OWN_APPOINTMENTS"]})}),false);
 assert.equal(await authorize(request,{...fixture(),membership:async()=>({...await fixture().membership(),active:false})}),false);
 assert.equal(await authorize(request,{...fixture(),membership:async()=>({...await fixture().membership(),revision:2})}),false);
});
test("mutation freshness and fail closed",async()=>{
 const t={...fixture(),policy:async()=>({...await fixture().policy(),grants:["OWN_APPOINTMENTS","EDIT_BOOKINGS"]})};
 assert.equal(await authorize({...request,action:"edit",expectedRevision:1},t),true);
 assert.equal(await authorize({...request,action:"edit",expectedRevision:2},t),false);
 assert.equal(await authorize({...request,action:"edit",expectedRevision:1},{...t,booking:async()=>({...await fixture().booking(),historical:true})}),false);
 assert.equal(await authorize(request,{...fixture(),policy:async()=>{throw Error("unavailable")}}),false);
});
