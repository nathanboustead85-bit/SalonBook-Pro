"use strict";
/** Local-only HTTP demo server, never a Firebase function or Hosting rewrite. */
const http=require("node:http"),fs=require("node:fs"),path=require("node:path");
const {guard}=require("./phase113DemoBookingEngine");
const {createDemoJourney}=require("./phase115DemoJourney");
function createDemoServer({db,auth}){
 guard();const journey=createDemoJourney({db,auth});
 return http.createServer(async(req,res)=>{
  const respond=(code,data)=>{res.writeHead(code,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});res.end(JSON.stringify(data));};
  try{
   guard();
   if(req.method==="GET"&&req.url?.split("?")[0]==="/"){
    res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Content-Security-Policy":"default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'","X-Content-Type-Options":"nosniff"});
    return res.end(fs.readFileSync(path.join(__dirname,"../demo/phase115/index.html")));
   }
   const actions={"/api/catalogue":"catalogue","/api/availability":"availability","/api/book":"book"};
   const action=actions[req.url];
   if(req.method!=="POST"||!action)return respond(404,{error:"Not found"});
   if(req.headers["content-type"]?.split(";")[0]!=="application/json")return respond(415,{error:"JSON required"});
   let body="";for await(const chunk of req){body+=chunk;if(body.length>8192)return respond(413,{error:"Request too large"});}
   const args=JSON.parse(body);
   if(!args||typeof args!=="object"||Array.isArray(args))return respond(400,{error:"Invalid JSON object"});
   if(action==="catalogue"&&Object.keys(args).join(",")!=="businessId")return respond(400,{error:"Invalid catalogue request"});
   if(action==="availability"&&(Object.keys(args).sort().join(",")!=="businessId,date,serviceId,staffId"))return respond(400,{error:"Invalid availability request"});
   return respond(200,await (action==="catalogue"?journey.catalogue(args.businessId):journey[action](args)));
  }catch(e){return respond(400,{error:String(e.message||"Request rejected").slice(0,200)});}
 });
}
if(require.main===module){
 guard();
 const admin=require("firebase-admin");
 if(!admin.apps.length)admin.initializeApp({projectId:"demo-boustio-legacy-init"});
 const server=createDemoServer({db:admin.firestore(),auth:admin.auth()});
 server.listen(0,"127.0.0.1",()=>console.log("Demo only: http://127.0.0.1:"+server.address().port+"/?businessId=demo_salon"));
}
module.exports={createDemoServer};
