"use strict";
const https=require("node:https");
const {decodePayload,EXPECTED}=require("./phase1732_oidc_claims");
const AUDIENCE="projects/107806967630/locations/global/workloadIdentityPools/boustio-github/providers/github-development-deploy";
function classify(sub,claims){
 if(typeof sub!=="string"||sub.length>4096)return {valid:false};
 const parts=sub.split(":");
 if(parts.length!==4||parts[0]!=="repo"||parts[2]!=="environment")return {valid:false};
 const id=parts[1], env=parts[3];
 const refs=[
  ["JOB_WORKFLOW_REF",claims.job_workflow_ref],
  ["WORKFLOW_REF",claims.workflow_ref],
  ["REPOSITORY_AT_REF",typeof claims.repository==="string"&&typeof claims.ref==="string"?claims.repository+"@"+claims.ref:null],
  ["REPOSITORY_AT_WORKFLOW",typeof claims.repository==="string"&&typeof claims.workflow==="string"?claims.repository+"@"+claims.workflow:null],
  ["REPOSITORY_AT_SHA",typeof claims.repository==="string"&&typeof claims.sha==="string"?claims.repository+"@"+claims.sha:null],
  ["REPOSITORY_AT_JOB_WORKFLOW_REF",typeof claims.repository==="string"&&typeof claims.job_workflow_ref==="string"?claims.repository+"@"+claims.job_workflow_ref:null]
 ];
 const matches=refs.filter(([,v])=>typeof v==="string"&&id===v).map(([k])=>k);
 const workflowClaim=typeof claims.job_workflow_ref==="string"?"PRESENT":"ABSENT";
 const workflowRefClaim=typeof claims.workflow_ref==="string"?"PRESENT":"ABSENT";
 return {valid:true,matches,workflowClaim,workflowRefClaim,
  containsWorkflowPath:id.includes("/.github/workflows/"),
  containsAtRef:id.includes("@refs/heads/"),
  containsAtSha:/@[a-f0-9]{40}$/i.test(id),
  containsAtTag:id.includes("@refs/tags/"),
  containsExpectedRepository:id.includes(EXPECTED.repository),
  environmentMatches:env===EXPECTED.environment,
  repoClaimMatches:claims.repository===EXPECTED.repository,
  refClaimMatches:claims.ref===EXPECTED.ref,
  environmentClaimMatches:claims.environment===EXPECTED.environment};
}
function requestToken(){
 return new Promise((resolve,reject)=>{
  const raw=process.env.ACTIONS_ID_TOKEN_REQUEST_URL, bearer=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if(!raw||!bearer)return reject(Error("OIDC_CONTEXT_MISSING"));
  const url=new URL(raw);
  if(url.protocol!=="https:"||!(url.hostname==="token.actions.githubusercontent.com"||url.hostname.endsWith(".actions.githubusercontent.com")))return reject(Error("OIDC_ENDPOINT_REJECTED"));
  url.searchParams.set("audience",AUDIENCE);
  const req=https.get(url,{headers:{Authorization:"Bearer "+bearer}},res=>{
   let body="";
   res.on("data",c=>{body+=c;if(body.length>65536)req.destroy(Error("OIDC_RESPONSE_TOO_LARGE"));});
   res.on("end",()=>{try{if(res.statusCode!==200)throw Error("OIDC_FETCH_FAILED");resolve(JSON.parse(body).value);}catch(e){reject(e);}});
  });
  req.setTimeout(15000,()=>req.destroy(Error("OIDC_FETCH_TIMEOUT")));
  req.on("error",reject);
 });
}
async function main(){
 if(process.env.BOUSTIO_PHASE1736_APPROVAL!=="CHECK_WORKFLOW_REFERENCE"||process.env.GITHUB_REPOSITORY!==EXPECTED.repository||process.env.GITHUB_REF!==EXPECTED.ref){
  console.log("Phase 17.36: CONFIGURATION_REJECTED");process.exitCode=1;return;
 }
 try{
  const claims=decodePayload(await requestToken());
  const c=classify(claims.sub,claims);
  if(!c.valid)throw Error("SUBJECT_STRUCTURE_UNEXPECTED");
  for(const [key,value] of Object.entries(c)){
   if(key==="valid")continue;
   console.log("Phase 17.36: "+key.toUpperCase()+" "+(Array.isArray(value)?value.join(",")||"NONE":typeof value==="boolean"?(value?"YES":"NO"):value));
  }
  console.log("Phase 17.36: DIAGNOSTIC_COMPLETE");
 }catch(e){
  const safe=["OIDC_CONTEXT_MISSING","OIDC_ENDPOINT_REJECTED","OIDC_RESPONSE_TOO_LARGE","OIDC_FETCH_FAILED","OIDC_FETCH_TIMEOUT","SUBJECT_STRUCTURE_UNEXPECTED"];
  console.log("Phase 17.36: ERROR "+(safe.includes(e.message)?e.message:"UNEXPECTED_ERROR"));process.exitCode=1;
 }
 console.log("Phase 17.36: NO_RAW_SUBJECT_NO_TOKEN_NO_CLOUD_API_NO_WRITES");
}
if(require.main===module)main();
module.exports={classify};
