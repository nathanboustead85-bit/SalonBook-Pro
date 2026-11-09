"use strict";
/** Emulator-only Android-calendar UI state adapter; never exported/deployed. */
const {guard}=require("./phase113DemoBookingEngine");
function createDemoCalendarController({bridge,onRender,onState,retryDelayMs=1000}){
 guard();
 if(!bridge||typeof bridge.subscribe!=="function"||typeof onRender!=="function"||typeof onState!=="function")throw Error("trusted calendar adapter required");
 if(!Number.isInteger(retryDelayMs)||retryDelayMs<10||retryDelayMs>30000)throw Error("invalid retry delay");
 let generation=0,stop=()=>{},timer=null,closed=true,latest=[],seen=false;
 function state(value){if(!closed)onState(value);}
 function clear(){if(timer!==null){clearTimeout(timer);timer=null;}stop();stop=()=>{};}
 function render(payload){
  if(!payload||!Array.isArray(payload.appointments))throw Error("invalid calendar payload");
  const ids=new Set(),items=payload.appointments.map(a=>{
   if(!a||typeof a.id!=="string"||!a.id||ids.has(a.id)||!["confirmed","cancelled"].includes(a.status)||a.source!=="demo_customer_web")throw Error("invalid appointment");
   ids.add(a.id);return Object.freeze({...a});
  }).sort((a,b)=>a.startAt.localeCompare(b.startAt)||a.id.localeCompare(b.id));
  latest=items;seen=true;onRender([...items]);
 }
 async function connect(params,token){
  try{
   const unsubscribe=await bridge.subscribe({...params,onChange:payload=>{if(closed||generation!==token)return;try{render(payload);state("connected");}catch(e){failure(e,token);}},onError:e=>failure(e,token)});
   if(closed||generation!==token){unsubscribe();return;}
   stop=unsubscribe;
  }catch(e){failure(e,token);}
 }
 let activeParams=null;
 function failure(error,token){
  if(closed||generation!==token||timer!==null)return;
  stop();stop=()=>{};state(seen?"reconnecting":"connecting");
  timer=setTimeout(()=>{timer=null;if(!closed&&generation===token)connect(activeParams,token);},retryDelayMs);
 }
 return Object.freeze({
  start(params){
   guard();if(!params||typeof params.businessId!=="string"||typeof params.ownerToken!=="string"||typeof params.date!=="string")throw Error("invalid calendar parameters");
   generation++;clear();closed=false;seen=false;latest=[];activeParams={...params};onRender([]);state("connecting");connect(activeParams,generation);
  },
  stop(){generation++;closed=true;clear();latest=[];seen=false;activeParams=null;},
  getSnapshot(){return [...latest];}
 });
}
module.exports={createDemoCalendarController};
