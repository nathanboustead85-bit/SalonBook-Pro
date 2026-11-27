const {test}=require("node:test");
const a=require("node:assert/strict");
const {createRecoverySession}=require("../sync/business-web-recovery-session.cjs");
test("in-flight duplicates blocked and lost receipt retried only with original identity",async()=>{
 let session={uid:"owner",businessId:"owner",verified:true,token:"test",epoch:1},calls=0,release;
 const draft={appointmentId:"booking",action:"cancel",expectedRevision:2};
 const gate=new Promise(r=>release=r);
 const recovery=createRecoverySession({session:()=>session,transport:async(token,request)=>{
 if(++calls===1){await gate;throw Error("Offline");}
 return {receiptVersion:1,accepted:true,status:"accepted",businessId:"owner",actorId:"owner",appointmentId:"booking",requestId:request.requestId,revision:3};
 }});
 const first=recovery.send(draft,"retry");
 const failed=a.rejects(first,/Offline/);
 a.equal(recovery.state(),"submitting");
 await a.rejects(recovery.send(draft,"retry"),/Submission in progress/);
 release();await failed;
 a.equal(recovery.state(),"unresolved");
 await a.rejects(recovery.send(draft,"different"),/Unresolved request/);
 session={...session,epoch:2};
 await a.rejects(recovery.send(draft,"retry"),/Unresolved request/);
 session={...session,epoch:1};
 a.equal((await recovery.send(draft,"retry")).revision,3);
 a.equal(recovery.state(),"idle");a.equal(calls,2);
});
