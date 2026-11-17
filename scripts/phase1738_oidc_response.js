"use strict";
const https=require("node:https");
const REPO="nathanboustead85-bit/SalonBook-Pro";
const ALLOWED_KEYS=new Set(["use_default","include_claim_keys"]);
const ALLOWED_CLAIMS=new Set(["repo","repository","repository_id","repository_owner","repository_owner_id","context","job_workflow_ref","workflow_ref","environment","ref","actor","actor_id"]);
function classify(status,body){
 if(status!==200)return {result:({401:"UNAUTHORIZED",403:"FORBIDDEN_OR_INSUFFICIENT_PERMISSIONS",404:"NOT_FOUND_OR_INACCESSIBLE",429:"RATE_LIMITED"})[status]||"HTTP_OTHER"};
 let data;
 try{data=JSON.parse(body);}catch{return {result:"NON_JSON_RESPONSE"};}
 if(!data||typeof data!=="object"||Array.isArray(data))return {result:"UNEXPECTED_TOP_LEVEL_TYPE"};
 const keys=Object.keys(data);
 const keyCategories=keys.map(k=>ALLOWED_KEYS.has(k)?k:"OTHER").sort();
 const useDefault=typeof data.use_default==="boolean"?(data.use_default?"YES":"NO"):"ABSENT_OR_NONBOOLEAN";
 const claimKeys=Array.isArray(data.include_claim_keys)?data.include_claim_keys.filter(x=>typeof x==="string").map(x=>ALLOWED_CLAIMS.has(x)?x:"OTHER"):[];
 const claimsState=Array.isArray(data.include_claim_keys)?"ARRAY":data.include_claim_keys===undefined?"ABSENT":"OTHER_TYPE";
 return {result:"STRUCTURE_INSPECTED",fieldCount:keys.length,fieldCategories:keyCategories.join(",")||"NONE",useDefault,claimsState,claimCount:claimKeys.length,claimCategories:claimKeys.join(",")||"NONE",defaultConfirmed:useDefault==="YES",customConfirmed:useDefault==="NO"};
}
function requestSettings(token){
 return new Promise((resolve,reject)=>{
  const req=https.get({hostname:"api.github.com",path:"/repos/"+REPO+"/actions/oidc/customization/sub",headers:{"Accept":"application/vnd.github+json","Authorization":"Bearer "+token,"X-GitHub-Api-Version":"2022-11-28","User-Agent":"boustio-oidc-readonly"}},res=>{
   let body="";
   res.on("data",chunk=>{body+=chunk;if(body.length>32768)req.destroy(Error("RESPONSE_TOO_LARGE"));});
   res.on("end",()=>resolve(classify(res.statusCode,body)));
  });
  req.setTimeout(15000,()=>req.destroy(Error("REQUEST_TIMEOUT")));
  req.on("error",reject);
 });
}
async function main(){
 if(process.env.BOUSTIO_PHASE1738_APPROVAL!=="INSPECT_OIDC_RESPONSE"||process.env.GITHUB_REPOSITORY!==REPO||process.env.GITHUB_REF!=="refs/heads/milestone-customer-booking-experience"){
  console.log("Phase 17.38: CONFIGURATION_REJECTED");process.exitCode=1;return;
 }
 try{
  if(!process.env.GITHUB_TOKEN)throw Error("TOKEN_UNAVAILABLE");
  const r=await requestSettings(process.env.GITHUB_TOKEN);
  for(const [key,value] of Object.entries(r)){
   console.log("Phase 17.38: "+key.toUpperCase()+" "+value);
  }
  if(r.result!=="STRUCTURE_INSPECTED")console.log("Phase 17.38: SETTINGS_NOT_VERIFIED");
 }catch(e){
  console.log("Phase 17.38: ERROR "+(["RESPONSE_TOO_LARGE","REQUEST_TIMEOUT","TOKEN_UNAVAILABLE"].includes(e.message)?e.message:"REQUEST_FAILED"));
  process.exitCode=1;
 }
 console.log("Phase 17.38: NO_RAW_RESPONSE_NO_TOKEN_NO_DEPLOYMENT_NO_FIRESTORE_WRITES");
}
if(require.main===module)main();
module.exports={classify};
