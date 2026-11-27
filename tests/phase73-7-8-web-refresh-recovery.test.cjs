const {test}=require("node:test");
const a=require("node:assert/strict");
const {reconcileRefresh}=require("../sync/business-web-refresh-recovery.cjs");
test("refresh lookup confirms only matching authoritative receipts and never resubmits",async()=>{
 let session={uid:"owner",businessId:"owner",verified:true,token:"test",epoch:1};
 const receipt={receiptVersion:1,accepted:true,status:"accepted",actorId:"owner",businessId:"owner",requestId:"retry",revision:3};
 const run=lookup=>reconcileRefresh({session:()=>session,lookup},"retry");
 a.deepEqual(await run(async(token,query)=>{a.equal(token,"test");a.deepEqual(query,{businessId:"owner",requestId:"retry"});return receipt;}),{state:"confirmed",revision:3});
 for(const patch of [{actorId:"other"},{businessId:"other"},{requestId:"other"},{revision:0},{accepted:false}])a.deepEqual(await run(async()=>({...receipt,...patch})),{state:"unresolved"});
 a.deepEqual(await run(async()=>null),{state:"unresolved"});
 a.deepEqual(await run(async()=>{throw Error("offline");}),{state:"unresolved"});
 a.deepEqual(await run(async()=>{session={...session,epoch:2};return receipt;}),{state:"blocked"});
 session={...session,verified:false};
 a.deepEqual(await run(async()=>{a.fail("lookup must not run");}),{state:"blocked"});
});
