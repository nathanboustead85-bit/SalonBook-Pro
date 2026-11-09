"use strict";
/** Phase 11.11 emulator-only unified calendar projection. No production exports. */
const {guard}=require("./phase113DemoBookingEngine");
const {createOwnerCalendarBridge}=require("./phase116OwnerCalendarBridge");
function createUnifiedCalendarFeed({db,authorizeOwner}={}){
 guard();
 const bridge=createOwnerCalendarBridge({db,authorizeOwner});
 let active=null,revision=0;
 return Object.freeze({
  async connect({businessId,ownerToken,date,onUpdate,onError}){
   guard();
   if(typeof onUpdate!=="function"||typeof onError!=="function")throw Error("callbacks required");
   const generation=++revision;
   if(active){active();active=null;}
   let unsubscribe;
   try{
    unsubscribe=await bridge.subscribe({businessId,ownerToken,date,
     onChange:payload=>{
      if(generation!==revision)return;
      try{
       const unique=new Set();
       const items=payload.appointments.map(a=>{
        if(!a.id||unique.has(a.id)||a.source!=="demo_customer_web"||!["confirmed","cancelled"].includes(a.status))throw Error("invalid calendar item");
        unique.add(a.id);
        return Object.freeze({id:a.id,serviceId:a.serviceId,staffId:a.staffId,startAt:a.startAt,endAt:a.endAt,status:a.status,source:a.source});
       });
       onUpdate(Object.freeze({date:payload.date,items:Object.freeze(items)}));
      }catch(e){onError(e);}
     },onError:e=>{if(generation===revision)onError(e);}
    });
    if(generation!==revision){unsubscribe();return ()=>{};}
    active=unsubscribe;
    return ()=>{if(generation===revision){revision++;active=null;unsubscribe();}};
   }catch(e){if(generation===revision)onError(e);throw e;}
  },
  disconnect(){revision++;if(active){active();active=null;}}
 });
}
module.exports={createUnifiedCalendarFeed};
