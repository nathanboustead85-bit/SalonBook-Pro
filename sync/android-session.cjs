"use strict";
const {createQueue}=require("./android-queue.cjs");
function createSessionQueue(){
 let session=null,epoch=0,queue=createQueue();
 function valid(token){return session!==null&&token===epoch;}
 return {
 start(s){if(!s||s.verified!==true||![s.uid,s.businessId].every(x=>typeof x==="string"&&/^[A-Za-z0-9_-]{1,128}$/.test(x)))throw Error("Denied");session=Object.freeze({...s});queue=createQueue();return ++epoch;},
 stop(token){if(!valid(token))throw Error("Stale session");const snapshot=queue.snapshot(session);session=null;queue=createQueue();epoch++;return snapshot;},
 restore(token,raw){if(!valid(token))throw Error("Stale session");return queue.restore(session,raw);},
 enqueue(token,d,id){if(!valid(token))throw Error("Stale session");return queue.enqueue(session,d,id);},
 pending(token,online){return valid(token)?queue.pending(session,online):[];},
 acknowledge(token,id,r){return valid(token)?queue.acknowledge(session,id,r):"blocked";}
 };
}
module.exports={createSessionQueue};
