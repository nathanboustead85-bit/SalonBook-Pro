"use strict";
const https=require("node:https");
const REPO="nathanboustead85-bit/SalonBook-Pro";
function classify(status,body){
 if(status===200){
  let parsed;
  try{parsed=JSON.parse(body);}catch{return {result:"INVALID_RESPONSE"};}
  if(typeof parsed.use_default!=="boolean"||!Array.isArray(parsed.include_claim_keys))return {result:"INVALID_RESPONSE"};
  const known=new Set(["repo","repository","repository_id","repository_owner","repository_owner_id","context","job_workflow_ref","workflow_ref","environment","ref","actor","actor_id"]);
  return {result:"READ_SUCCESS",useDefault:parsed.use_default,claimCount:parsed.include_claim_keys.length,
   claimKeys:parsed.include_claim_keys.map(k=>known.has(k)?k:"OTHER").join(",")||"NONE"};
 }
 if(status===401)return {result:"UNAUTHORIZED"};
 if(status===403)return {result:"FORBIDDEN_OR_INSUFFICIENT_PERMISSIONS"};
 if(status===404)return {result:"NOT_FOUND_OR_INACCESSIBLE"};
 if(status===429)return {result:"RATE_LIMITED"};
 return {result:"HTTP_"+String(status)};
}
function requestSettings(token){
 return new Promise((resolve,reject)=>{
  const path="/repos/"+REPO+"/actions/oidc/customization/sub";
  const req=https.get({hostname:"api.github.com",path,headers:{"Accept":"application/vnd.github+json","Authorization":"Bearer "+token,"X-GitHub-Api-Version":"2022-11-28","User-Agent":"boustio-oidc-readonly"}},res=>{
   let body="";
   res.on("data",chunk=>{body+=chunk;if(body.length>32768)req.destroy(Error("RESPONSE_TOO_LARGE"));});
   res.on("end",()=>resolve(classify(res.statusCode,body)));
  });
  req.setTimeout(15000,()=>req.destroy(Error("REQUEST_TIMEOUT")));
  req.on("error",reject);
 });
}
async function main(){
 if(process.env.BOUSTIO_PHASE1737_APPROVAL!=="READ_OIDC_SETTINGS"||process.env.GITHUB_REPOSITORY!==REPO||process.env.GITHUB_REF!=="refs/heads/milestone-customer-booking-experience"){
  console.log("Phase 17.37: CONFIGURATION_REJECTED");process.exitCode=1;return;
 }
 try{
  const token=process.env.GITHUB_TOKEN;
  if(!token)throw Error("TOKEN_UNAVAILABLE");
  const result=await requestSettings(token);
  console.log("Phase 17.37: RESULT "+result.result);
  if(result.result==="READ_SUCCESS"){
   console.log("Phase 17.37: USE_DEFAULT "+(result.useDefault?"YES":"NO"));
   console.log("Phase 17.37: CLAIM_COUNT "+result.claimCount);
   console.log("Phase 17.37: CLAIM_KEYS "+result.claimKeys);
  }
  if(result.result!=="READ_SUCCESS")console.log("Phase 17.37: SETTINGS_NOT_VERIFIED_NO_PERMISSION_ESCALATION");
 }catch(e){
  console.log("Phase 17.37: ERROR "+(["RESPONSE_TOO_LARGE","REQUEST_TIMEOUT","TOKEN_UNAVAILABLE"].includes(e.message)?e.message:"REQUEST_FAILED"));
  process.exitCode=1;
 }
 console.log("Phase 17.37: READ_ONLY_NO_SETTINGS_CHANGES_NO_DEPLOYMENT_NO_FIRESTORE_WRITES");
}
if(require.main===module)main();
module.exports={classify};
