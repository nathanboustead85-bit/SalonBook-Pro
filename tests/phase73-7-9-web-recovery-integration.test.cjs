const {test}=require("node:test");
const a=require("node:assert/strict");
const {createRecoveryController}=require("../sync/business-web-recovery-controller.cjs");
test("restored unresolved request blocks writes until matching receipt",async()=>{
 let session={uid:"owner",businessId:"owner",verified:true,token:"test",epoch:1},online=false,calls=0;
 const receipt=id=>({receiptVersion:1,accepted:true,status:"accepted",actorId:"owner",businessId:"owner",appointmentId:"booking",requestId:id,revision:3});
 const controller=createRecoveryController({session:()=>session,pendingRequestId:"old",lookup:async()=>{if(!online)throw Error("offline");return receipt("old");},transport:async(t,r)=>{calls++;return receipt(r.requestId);}});
 const draft={appointmentId:"booking",action:"cancel",expectedRevision:2};
 await a.rejects(controller.submit(draft,"new"),/Recovery required/);
 a.equal((await controller.reconcile()).state,"unresolved");
 online=true;
 session={...session,verified:false};
 a.equal((await controller.reconcile()).state,"blocked");
 session={...session,verified:true};
 a.equal((await controller.reconcile()).state,"confirmed");
 a.equal(controller.state(),"idle");
 a.equal((await controller.submit(draft,"new")).revision,3);
 a.equal(calls,1);
});
