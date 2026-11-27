const {test}=require("node:test");
const a=require("node:assert/strict");
const {bindRecoveryUI}=require("../sync/business-web-recovery-ui.cjs");
const {createRecoveryController}=require("../sync/business-web-recovery-controller.cjs");
function button(){let handler;return {disabled:false,addEventListener:(n,h)=>handler=h,removeEventListener:()=>handler=null,click:()=>handler?.()};}
test("UI blocks submission after lost acknowledgement until receipt reconciliation",async()=>{
 const session=()=>({uid:"owner",businessId:"owner",verified:true,token:"test",epoch:1});
 let writes=0,online=false;
 const receipt={receiptVersion:1,accepted:true,status:"accepted",actorId:"owner",businessId:"owner",appointmentId:"booking",requestId:"retry",revision:3};
 const controller=createRecoveryController({session,transport:async()=>{writes++;throw Error("offline");},lookup:async()=>{if(!online)throw Error("offline");return receipt;}});
 const submitButton=button(),recoverButton=button(),status={};
 const dispose=bindRecoveryUI({controller,submitButton,recoverButton,status,readDraft:()=>({draft:{appointmentId:"booking",action:"cancel",expectedRevision:2},id:"retry"})});
 a.equal(submitButton.disabled,false);
 await submitButton.click();
 a.equal(submitButton.disabled,true);a.match(status.textContent,/unresolved/);
 await submitButton.click();a.equal(writes,1);
 await recoverButton.click();a.equal(submitButton.disabled,true);
 online=true;await recoverButton.click();a.equal(submitButton.disabled,false);
 a.equal(writes,1);dispose();await submitButton.click();a.equal(writes,1);
});
