"use strict";
// Phase 13.7: deployable-backend-agnostic HTTP handler for trusted slug lookup.
// The injected lookup must be SERVER-SIDE, authoritative, and indexed by exact slug.
// Never perform a Firestore collection scan (publicBusinesses list is denied).
// Deployment, rate limiting, CORS policy and server credentials remain host responsibilities.
const slugPattern=/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const idPattern=/^[A-Za-z0-9_-]{1,128}$/;
const respond=(status,body)=>({status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"},body});
function createSlugLookupHandler(authoritativeLookup){
 if(typeof authoritativeLookup!=="function")throw new TypeError("server-side authoritative lookup required");
 return async function handle(request){
  if(!request||request.method!=="GET")return respond(405,{status:"METHOD_NOT_ALLOWED"});
  let slug;
  try{
   const url=new URL(request.url,"https://boustio.invalid");
   const params=url.searchParams.getAll("business");
   if(params.length!==1||!slugPattern.test(params[0]))return respond(400,{status:"INVALID_BUSINESS"});
   slug=params[0];
  }catch{return respond(400,{status:"INVALID_BUSINESS"});}
  try{
   const result=await authoritativeLookup(slug);
   if(!result||result.slug!==slug||result.published!==true||typeof result.businessId!=="string"||!idPattern.test(result.businessId))
    return respond(404,{status:"NOT_FOUND"});
   // Only return the three public mapping fields, never the source document.
   return respond(200,{status:"FOUND",slug,businessId:result.businessId,published:true});
  }catch{return respond(503,{status:"LOOKUP_UNAVAILABLE"});}
 };
}
module.exports=Object.freeze({createSlugLookupHandler});
