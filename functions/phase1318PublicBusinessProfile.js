"use strict";
// Phase 13.18: read-only public profile lookup using existing canonical
// businessSlugs collection. No private reads, no bookings, no service claims.
const slugPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const idPattern=/^[A-Za-z0-9_-]{1,128}$/;
function response(status,body){return {status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"},body};}
function createPublicBusinessProfileReader(db){
 if(!db||typeof db.collection!=="function")throw new TypeError("Firestore required");
 return async function(slug){
  if(typeof slug!=="string"||slug.length<3||slug.length>50||!slugPattern.test(slug))
   return response(400,{status:"INVALID_SLUG"});
  try{
   const mapping=await db.collection("businessSlugs").doc(slug).get();
   if(!mapping.exists)return response(404,{status:"NOT_FOUND"});
   const id=mapping.get("businessId");
   if(typeof id!=="string"||!idPattern.test(id))return response(404,{status:"NOT_FOUND"});
   const profile=await db.collection("publicBusinesses").doc(id).get();
   if(!profile.exists||profile.get("published")!==true||profile.get("slug")!==slug)
    return response(404,{status:"NOT_FOUND"});
   const name=profile.get("name");
   if(typeof name!=="string"||name.trim().length<3||name.length>100)return response(404,{status:"NOT_FOUND"});
   const description=profile.get("description");
   return response(200,{status:"PUBLIC_PROFILE_READY",business:{
    slug,name,description:typeof description==="string"?description.slice(0,2000):"",
    acceptingBookings:false
   }});
  }catch{return response(503,{status:"PUBLIC_PROFILE_UNAVAILABLE"});}
 };
}
function createPublicBusinessHttpHandler(db){
 const read=createPublicBusinessProfileReader(db);
 return async function(req,res){
  res.set("cache-control","no-store");res.set("x-content-type-options","nosniff");
  if(req.method!=="GET"){res.set("allow","GET");return res.status(405).json({status:"METHOD_NOT_ALLOWED"});}
  const query=req.query||{},keys=Object.keys(query);
  if(keys.length!==1||keys[0]!=="business"||typeof query.business!=="string")
   return res.status(400).json({status:"INVALID_SLUG"});
  const result=await read(query.business);
  return res.status(result.status).json(result.body);
 };
}
module.exports=Object.freeze({createPublicBusinessProfileReader,createPublicBusinessHttpHandler});
