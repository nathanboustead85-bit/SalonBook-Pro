"use strict";
const {reconcileRefresh}=require("./business-web-refresh-recovery.cjs");
const {createRecoverySession}=require("./business-web-recovery-session.cjs");
function createRecoveryController({session,transport,lookup,pendingRequestId=null}){
 let recovery=createRecoverySession({session,transport});
 let pending=pendingRequestId,busy=false;
 return {
 state:()=>busy?"busy":pending!==null?"unresolved":"idle",
 async submit(draft,id){
 if(busy||pending!==null)throw Error("Recovery required");
 busy=true;
 pending=id;
 try{const receipt=await recovery.send(draft,id);pending=null;return receipt;}
 finally{busy=false;}
 },
 async reconcile(){
 if(busy||pending===null)throw Error("No available reconciliation");
 busy=true;
 try{const result=await reconcileRefresh({session,lookup},pending);
 if(result.state==="confirmed"){pending=null;recovery=createRecoverySession({session,transport});}
 return result;
 }finally{busy=false;}
 }
 };
}
module.exports={createRecoveryController};
