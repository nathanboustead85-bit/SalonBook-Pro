"use strict";
// Injected transport only: no live endpoint.
function createDrain(queue,send){
 let busy=false;
 return async function drain(token,online){
 if(busy||online!==true)return "idle";
 busy=true;
 try{
 for(const request of queue.pending(token,true)){
 if(!queue.pending(token,true).some(r=>r.requestId===request.requestId))return "blocked";
 let receipt;
 try{receipt=await send(request);}catch{return "retry";}
 const state=queue.acknowledge(token,request.requestId,receipt);
 if(state!=="confirmed"&&state!=="conflict")return state;
 }
 return "done";
 }finally{busy=false;}
 };
}
module.exports={createDrain};
