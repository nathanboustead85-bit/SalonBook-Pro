"use strict";
const https=require("node:https");
const {decodePayload,EXPECTED}=require("./phase1732_oidc_claims");
const AUDIENCE="projects/107806967630/locations/global/workloadIdentityPools/boustio-github/providers/github-development-deploy";
function verify(claims){
 return claims.repository===EXPECTED.repository&&claims.ref===EXPECTED.ref&&claims.environment===EXPECTED.environment&&
 typeof claims.sub==="string"&&claims.sub.startsWith("repo:")&&claims.sub.endsWith(":environment:"+EXPECTED.environment)&&claims.sub.length<512;
}
function getToken(){
 return new Promise((resolve,reject)=>{
  const raw=process.env.ACTIONS_ID_TOKEN_REQUEST_URL,auth=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if(!raw||!auth)throw Error("MISSING_OIDC_CONTEXT");
  const u=new URL(raw);
  if(u.protocol!=="https:"||!(u.hostname==="token.actions.githubusercontent.com"||u.hostname.endsWith(".actions.githubusercontent.com")))throw Error("UNTRUSTED_ENDPOINT");
  u.searchParams.set("audience",AUDIENCE);
  const req=https.get(u,{headers:{Authorization:"Bearer "+auth}},res=>{
   let data="";res.on("data",c=>{data+=c;if(data.length>65536)req.destroy(Error("RESPONSE_TOO_LARGE"));});
   res.on("end",()=>{try{if(res.statusCode!==200)throw Error("TOKEN_REQUEST_FAILED");resolve(JSON.parse(data).value);}catch(e){reject(e);}});
  });
  req.setTimeout(15000,()=>req.destroy(Error("REQUEST_TIMEOUT")));req.on("error",reject);
 });
}
async function main(){
 if(process.env.BOUSTIO_APPROVAL!=="REVEAL_SUBJECT_ONLY"||process.env.GITHUB_REPOSITORY!==EXPECTED.repository||process.env.GITHUB_REF!==EXPECTED.ref){
  console.log("Boustio identity correction: SAFETY_GUARD_REJECTED");process.exitCode=1;return;
 }
 try{
  const claims=decodePayload(await getToken());
  if(!verify(claims))throw Error("CLAIMS_DID_NOT_MATCH");
  console.log("Boustio identity correction: VERIFIED_REPOSITORY_BRANCH_ENVIRONMENT");
  console.log("Boustio identity correction: SUBJECT_ONLY "+claims.sub);
  console.log("Boustio identity correction: EXPECTED_SUBJECT "+EXPECTED.sub);
  console.log("Boustio identity correction: MATCH "+(claims.sub===EXPECTED.sub?"YES":"NO"));
 }catch(e){
  console.log("Boustio identity correction: ERROR "+(["CLAIMS_DID_NOT_MATCH","TOKEN_REQUEST_FAILED","REQUEST_TIMEOUT","RESPONSE_TOO_LARGE","MISSING_OIDC_CONTEXT","UNTRUSTED_ENDPOINT"].includes(e.message)?e.message:"DIAGNOSTIC_FAILED"));process.exitCode=1;
 }
 console.log("Boustio identity correction: NO_JWT_NO_AUTH_HEADERS_NO_CLOUD_CHANGES_NO_FIRESTORE_WRITES");
}
if(require.main===module)main();
module.exports={verify};
