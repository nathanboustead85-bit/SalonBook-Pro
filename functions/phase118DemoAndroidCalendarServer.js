"use strict";
/** Phase 11.8 loopback-only debug owner calendar endpoint. Never deploy. */
const http=require("node:http");
const {guard}=require("./phase113DemoBookingEngine");
const {createOwnerCalendarBridge}=require("./phase116OwnerCalendarBridge");
const {createDemoOwnerAuthorizer}=require("./phase116OwnerAuthorizer");
function createDemoAndroidCalendarServer({db,auth}){
 guard();
 const bridge=createOwnerCalendarBridge({db,authorizeOwner:createDemoOwnerAuthorizer({db,auth})});
 return http.createServer(async(req,res)=>{
  const reply=(status,data)=>{res.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});res.end(JSON.stringify(data));};
  try{
   guard();
   if(req.method!=="POST"||req.url!=="/api/owner-calendar")return reply(404,{error:"Not found"});
   if(req.headers["content-type"]?.split(";")[0]!=="application/json")return reply(415,{error:"JSON required"});
   let body="";for await(const chunk of req){body+=chunk;if(body.length>8192)return reply(413,{error:"Request too large"});}
   const args=JSON.parse(body);
   if(!args||typeof args!=="object"||Array.isArray(args)||Object.keys(args).sort().join(",")!=="businessId,date,ownerToken")return reply(400,{error:"Invalid request"});
   return reply(200,await bridge.snapshot(args));
  }catch(e){return reply(403,{error:"Demo owner access denied or invalid request"});}
 });
}
if(require.main===module){
 guard();const admin=require("firebase-admin");if(!admin.apps.length)admin.initializeApp({projectId:"demo-boustio-legacy-init"});
 createDemoAndroidCalendarServer({db:admin.firestore(),auth:admin.auth()}).listen(8765,"127.0.0.1",()=>console.log("Local demo calendar only: 127.0.0.1:8765"));
}
module.exports={createDemoAndroidCalendarServer};
