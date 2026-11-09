"use strict";
/** Phase 11.7 loopback-only owner calendar HTTP bridge, no public endpoint. */
const http=require("node:http");
const {guard}=require("./phase113DemoBookingEngine");
const {createOwnerCalendarBridge}=require("./phase116OwnerCalendarBridge");
const {createDemoOwnerAuthorizer}=require("./phase116OwnerAuthorizer");
function createCalendarDevServer({db,auth}){
 guard();const bridge=createOwnerCalendarBridge({db,authorizeOwner:createDemoOwnerAuthorizer({db,auth})});
 return http.createServer(async(req,res)=>{
  const send=(status,body)=>{res.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});res.end(JSON.stringify(body));};
  try{
   guard();
   if(req.method!=="POST"||req.url!=="/demo/calendar")return send(404,{error:"Not found"});
   if(req.headers["content-type"]?.split(";")[0]!=="application/json")return send(415,{error:"JSON required"});
   let raw="";for await(const chunk of req){raw+=chunk;if(raw.length>8192)return send(413,{error:"Too large"});}
   const args=JSON.parse(raw);
   if(!args||typeof args!=="object"||Array.isArray(args)||Object.keys(args).sort().join(",")!=="businessId,date,ownerToken")return send(400,{error:"Invalid request"});
   return send(200,await bridge.snapshot(args));
  }catch{return send(403,{error:"Calendar access denied or unavailable"});}
 });
}
if(require.main===module){
 guard();
 const admin=require("firebase-admin");
 if(!admin.apps.length)admin.initializeApp({projectId:"demo-boustio-legacy-init"});
 createCalendarDevServer({db:admin.firestore(),auth:admin.auth()}).listen(8765,"127.0.0.1",()=>console.log("Phase 11.7 Android emulator-only calendar bridge listening on host loopback :8765"));
}
module.exports={createCalendarDevServer};
