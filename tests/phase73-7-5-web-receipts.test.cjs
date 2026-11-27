const {test}=require("node:test");const a=require("node:assert/strict");const {createWebConnector}=require("../sync/business-web-connector.cjs");
test("website rejects malformed or mismatched authoritative receipts",async()=>{
 const session={uid:"owner",businessId:"owner",verified:true,token:"test",epoch:1};
 const draft={appointmentId:"booking",action:"create",expectedRevision:0,serviceId:"cut",staffId:"staff",date:"2026-12-01",startTime:"09:00"};
 const receipt={receiptVersion:1,accepted:true,status:"accepted",businessId:"owner",actorId:"owner",appointmentId:"booking",requestId:"request",revision:1};
 const submit=body=>createWebConnector({session:()=>session,transport:async()=>body})(draft,"request");
 a.deepEqual(await submit(receipt),receipt);
 for(const patch of [{receiptVersion:"1"},{accepted:"true"},{accepted:false},{status:"pending"},{businessId:"other"},{actorId:"other"},{appointmentId:"other"},{requestId:"other"},{revision:"1"},{revision:1.5},{revision:2}])await a.rejects(submit({...receipt,...patch}),/Invalid receipt/);
 await a.rejects(submit(null),/Invalid receipt/);
});
