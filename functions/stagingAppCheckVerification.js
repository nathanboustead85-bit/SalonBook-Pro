"use strict";
// Phase 27.2: isolated staging App Check verification boundary.
// Not wired to live callables. Only Firebase Admin SDK verifier results are trusted.
class AppCheckRejected extends Error{constructor(){super("App Check verification failed.");this.code="permission-denied";}}
async function verifyStagingAppCheck({token,verifyToken,enabled=false}={}){
 if(enabled!==true)throw new AppCheckRejected();
 if(typeof token!=="string"||token.length<8||token.length>8192||/\s/.test(token))throw new AppCheckRejected();
 if(typeof verifyToken!=="function")throw new AppCheckRejected();
 try{
  const result=await verifyToken(token,{consume:true});
  if(!result||typeof result.appId!=="string"||!result.appId.trim())throw new AppCheckRejected();
  if(result.alreadyConsumed===true)throw new AppCheckRejected();
  return Object.freeze({verified:true,appId:result.appId});
 }catch{throw new AppCheckRejected();}
}
module.exports={verifyStagingAppCheck,AppCheckRejected};
