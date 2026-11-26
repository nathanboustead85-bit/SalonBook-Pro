const {test}=require("node:test");
const assert=require("node:assert/strict");
const {authorize}=require("../security/employee-backend-preview.cjs");
test("appointment authorization matrix",async()=>{
 for(const active of [true,false]) for(const verified of [true,false]) for(const sameTenant of [true,false]) for(const own of [true,false]) for(const scope of ["none","own","all"]) for(const extra of [true,false]) for(const historical of [true,false]) for(const fresh of [true,false]) for(const action of ["view","contact","edit","cancel","delete"]) {
  const grants=scope==="none"?[]:[scope==="own"?"OWN_APPOINTMENTS":"ALL_APPOINTMENTS"];
  if(extra) grants.push("CUSTOMER_CONTACT","EDIT_BOOKINGS","CANCEL_BOOKINGS");
  const trusted={
   identity:async()=>({uid:"e",verified}),
   membership:async()=>({businessId:sameTenant?"b":"other",userId:"e",role:"EMPLOYEE",active,revision:1}),
   policy:async()=>({businessId:"b",userId:"e",membershipRevision:1,revision:1,grants}),
   booking:async()=>({businessId:"b",id:"a",staffUserId:own?"e":"other",revision:2,historical})
  };
  const expected=active&&verified&&sameTenant&&(scope==="all"||(scope==="own"&&own))&&(action==="view"||(action==="contact"&&extra)||(["edit","cancel"].includes(action)&&extra&&!historical&&fresh));
  assert.equal(await authorize({businessId:"b",bookingId:"a",action,expectedRevision:fresh?2:1,role:"OWNER"},trusted),expected);
 }
});
test("missing or unavailable trusted adapters deny access",async()=>{
 for(const input of [null,{}, {identity:async()=>{throw Error("offline")}}]) assert.equal(await authorize({businessId:"b",bookingId:"a",action:"view"},input),false);
});
