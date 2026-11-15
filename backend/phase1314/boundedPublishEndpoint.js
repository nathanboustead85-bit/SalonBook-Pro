"use strict";
// Phase 13.14: raw HTTP request body boundary, before JSON parsing.
// The HTTP server must provide the raw bytes without parsing or truncating them.
// Also configure the hosting platform's request-size and rate limits.
const {createValidatedPublishEndpoint}=require("../phase1313/validatedPublishEndpoint");
const MAX_BODY_BYTES=1024;
const fail=(status,label)=>({status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"},body:{status:label}});
function header(headers,name){
 if(!headers)return null;
 if(typeof headers.get==="function")return headers.get(name);
 const key=Object.keys(headers).find(k=>k.toLowerCase()===name);
 return key?headers[key]:null;
}
function createBoundedPublishEndpoint(db,auth,options){
 const validated=createValidatedPublishEndpoint(db,auth,options);
 return async function handle(request){
  if(!request||request.method!=="POST")return fail(405,"METHOD_NOT_ALLOWED");
  const declared=header(request.headers,"content-length");
  if(declared!==null&&declared!==undefined){
   if(typeof declared!=="string"||!/^(0|[1-9][0-9]*)$/.test(declared))return fail(400,"INVALID_CONTENT_LENGTH");
   if(Number(declared)>MAX_BODY_BYTES)return fail(413,"PAYLOAD_TOO_LARGE");
  }
  const raw=request.rawBody;
  if(!Buffer.isBuffer(raw)&&typeof raw!=="string")return fail(400,"RAW_BODY_REQUIRED");
  const bytes=Buffer.isBuffer(raw)?raw:Buffer.from(raw,"utf8");
  if(bytes.length>MAX_BODY_BYTES)return fail(413,"PAYLOAD_TOO_LARGE");
  if(declared!==null&&declared!==undefined&&Number(declared)!==bytes.length)return fail(400,"INVALID_CONTENT_LENGTH");
  // Fatal UTF-8 decoding avoids silently replacing invalid bytes.
  let body;
  try{
   const json=new TextDecoder("utf-8",{fatal:true}).decode(bytes);
   body=JSON.parse(json);
  }catch{return fail(400,"INVALID_JSON");}
  return validated({method:request.method,headers:request.headers,body});
 };
}
module.exports=Object.freeze({createBoundedPublishEndpoint,MAX_BODY_BYTES});
