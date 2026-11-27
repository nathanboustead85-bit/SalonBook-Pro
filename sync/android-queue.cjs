"use strict";
const {prepareRequest}=require("./android-request.cjs");
const {transition}=require("./android-contract.cjs");
function createQueue(){
 const entries=new Map();
 const scope=(s)=>{if(!s||s.verified!==true||![s.businessId,s.uid].every(v=>typeof v==="string"&&/^[A-Za-z0-9_-]{1,128}$/.test(v)))throw Error("Denied");return JSON.stringify([s.businessId,s.uid]);};
 const key=(s,id)=>JSON.stringify([scope(s),id]);
 return {
 enqueue(s,d,id){const request=prepareRequest(s,d,id),k=key(s,id),old=entries.get(k);if(old){if(JSON.stringify(old.request)!==JSON.stringify(request))throw Error("Request key reused");return old.state;}for(const e of entries.values())if(e.scope===scope(s)&&e.request.appointmentId===request.appointmentId&&e.state==="pending")throw Error("Pending appointment");entries.set(k,{scope:scope(s),request,state:"pending"});return "pending";},
 pending(s,online){const sc=scope(s);return online===true?[...entries.values()].filter(e=>e.scope===sc&&e.state==="pending").map(e=>e.request):[];},
 acknowledge(s,id,receipt){const e=entries.get(key(s,id));if(!e)return "blocked";if(e.state!=="pending")return e.state;const result=transition(e.request,receipt,s);if(["confirmed","conflict"].includes(result.state))e.state=result.state;return result.state;}
 };
}
module.exports={createQueue};
