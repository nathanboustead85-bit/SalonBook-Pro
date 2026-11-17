"use strict";
const https=require("node:https");
const EXPECTED={
 repository:"nathanboustead85-bit/SalonBook-Pro",
 ref:"refs/heads/milestone-customer-booking-experience",
 environment:"boustio-function-deployment",
 sub:"repo:nathanboustead85-bit/SalonBook-Pro:environment:boustio-function-deployment"
};
function validate(claims){
 const result={};
 for(const [key,value] of Object.entries(EXPECTED))result[key]=claims[key]===value;
 result.issuer=claims.iss==="https://token.actions.githubusercontent.com";
 result.audience=typeof claims.aud==="string"&&claims.aud.length>0;
 return result;
}
function decodePayload(jwt){
 const parts=jwt.split(".");
 if(parts.length!==3)throw Error("OIDC_TOKEN_FORMAT_INVALID");
 return JSON.parse(Buffer.from(parts[1],"base64url").toString("utf8"));
}
function fetchOidc(audience){
 return new Promise((resolve,reject)=>{
  const raw=process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const bearer=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if(!raw||!bearer)return reject(Error("OIDC_REQUEST_CONTEXT_MISSING"));
  const url=new URL(raw);
  if(url.protocol!=="https:")return reject(Error("OIDC_REQUEST_URL_REJECTED"));
  url.searchParams.set("audience",audience);
  const req=https.get(url,{headers:{Authorization:"Bearer "+bearer}},res=>{
   let body="";
   res.on("data",chunk=>{body+=chunk;if(body.length>65536)req.destroy(Error("OIDC_RESPONSE_TOO_LARGE"));});
   res.on("end",()=>{try{if(res.statusCode!==200)throw Error("OIDC_REQUEST_FAILED");resolve(JSON.parse(body).value);}catch(e){reject(e);}});
  });
  req.setTimeout(15000,()=>req.destroy(Error("OIDC_REQUEST_TIMEOUT")));
  req.on("error",reject);
 });
}
async function main(){
 if(process.env.BOUSTIO_PHASE1732_APPROVAL!=="VERIFY_OIDC_CLAIMS"||
 process.env.GITHUB_REPOSITORY!==EXPECTED.repository||
 process.env.GITHUB_REF!==EXPECTED.ref){
  console.log("Phase 17.32: CONFIGURATION_REJECTED");process.exitCode=1;return;
 }
 const audience="projects/107806967630/locations/global/workloadIdentityPools/boustio-github/providers/github-development-deploy";
 try{
  const jwt=await fetchOidc(audience);
  const result=validate(decodePayload(jwt));
  for(const [key,ok] of Object.entries(result))console.log("Phase 17.32: "+key.toUpperCase()+" "+(ok?"MATCH":"MISMATCH"));
  if(!Object.values(result).every(Boolean))process.exitCode=1;
 }catch(e){
  console.log("Phase 17.32: OIDC_DIAGNOSTIC_ERROR "+(/^[A-Z_]+$/.test(e.message)?e.message:"UNEXPECTED_ERROR"));
  process.exitCode=1;
 }
 console.log("Phase 17.32: NO_TOKEN_PRINTED_NO_DEPLOYMENT_NO_FIRESTORE_WRITES");
}
if(require.main===module)main();
module.exports={validate,decodePayload,EXPECTED};
