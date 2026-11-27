"use strict";
const http=require("node:http");
const {createHandler}=require("./integration-booking-handler.cjs");
function createBridge(options){
 const handle=createHandler(options);
 return http.createServer({requestTimeout:10000,headersTimeout:5000},async(req,res)=>{
  const reply=(status,body)=>{res.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store"});res.end(JSON.stringify(body));};
  if(req.socket.remoteAddress!=="127.0.0.1"||req.method!=="POST"||req.url!=="/booking")return reply(404,{error:"Unavailable"});
  if(req.headers["content-type"]!=="application/json")return reply(415,{error:"Invalid content"});
  try{
   let size=0;const chunks=[];
   for await(const chunk of req){size+=chunk.length;if(size>65536){req.destroy();return;}chunks.push(chunk);}
   const body=JSON.parse(Buffer.concat(chunks).toString("utf8"));
   const receipt=await handle(req.headers.authorization,body);
   reply(200,receipt);
  }catch(e){if(!res.destroyed)reply(e.message==="Unauthenticated"?401:400,{error:"Request rejected"});}
 });
}
async function listenBridge(options){
 const server=createBridge(options);
 await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
 return server;
}
module.exports={listenBridge};
