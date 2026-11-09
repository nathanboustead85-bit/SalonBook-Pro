"use strict";
/** Phase 11.17: staging transport harness, no deployment and no default remote endpoint. */
const {guard}=require("./phase113DemoBookingEngine");
const {validateRequest,projectSnapshot}=require("./phase1115CloudCalendarContract");
function createStagingCalendarTransport({fetchImpl,approvedOrigin}={}){
 guard();
 if(typeof fetchImpl!=="function")throw Error("explicit test transport required");
 if(typeof approvedOrigin!=="string")throw Error("explicit staging origin required");
 const origin=new URL(approvedOrigin);
 if(origin.protocol!=="https:"||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=="/"||origin.port||!/^staging-[a-z0-9-]+\.example\.test$/.test(origin.hostname))throw Error("synthetic staging host only");
 return Object.freeze({async read(input){
  guard();
  const request=validateRequest(input);
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),3000);
  try{
   const response=await fetchImpl(origin.href+"api/owner-calendar",{
    method:"POST",redirect:"error",signal:controller.signal,
    headers:{"Content-Type":"application/json","Cache-Control":"no-store"},
    body:JSON.stringify(request)
   });
   if(!response||response.status!==200||!response.headers?.get||!/application\/json/i.test(response.headers.get("content-type")||""))throw Error("staging feed unavailable");
   const raw=await response.text();
   if(raw.length>131072)throw Error("staging response too large");
   return projectSnapshot(request,JSON.parse(raw));
  }finally{clearTimeout(timeout);}
 }});
}
module.exports={createStagingCalendarTransport};
