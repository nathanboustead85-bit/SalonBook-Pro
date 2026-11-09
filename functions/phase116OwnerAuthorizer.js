"use strict";
/** Emulator-only verified business-owner adapter for the calendar bridge. */
const {guard}=require("./phase113DemoBookingEngine");
function createDemoOwnerAuthorizer({db,auth}={}){
 guard();if(!db||!auth||typeof auth.verifyIdToken!=="function")throw Error("trusted emulator dependencies required");
 return async ({businessId,ownerToken})=>{
  guard();
  if(typeof businessId!=="string"||!/^demo_[A-Za-z0-9_-]{3,75}$/.test(businessId)||typeof ownerToken!=="string"||!ownerToken)return false;
  try{
   const identity=await auth.verifyIdToken(ownerToken,true);
   if(!identity?.uid||identity.email_verified!==true)return false;
   const business=await db.collection("phase113DemoBusinesses").doc(businessId).get();
   return business.exists&&business.get("ownerUid")===identity.uid;
  }catch{return false;}
 };
}
module.exports={createDemoOwnerAuthorizer};
