"use strict";
const https=require("node:https");
const {decodePayload,EXPECTED}=require("./phase1732_oidc_claims");
const AUDIENCE="projects/107806967630/locations/global/workloadIdentityPools/boustio-github/providers/github-development-deploy";
const KEYS=new Set(["repo","environment","ref","pull_request","job_workflow_ref","context","repository_owner","repository_id","repository_owner_id","workflow","actor","actor_id"]);
function inspectSubject(sub){
 if(typeof sub!=="string"||sub.length>4096)return {valid:false};
 const segments=sub.split(":");
 const labels=[];
 for(let i=0;i<segments.length;i++){
  if(KEYS.has(segments[i]))labels.push(segments[i]);
 }
 const prefix=segments[0]||"";
 const standard=sub===EXPECTED.sub;
 const hasRepo=sub.includes(EXPECTED.repository);
 const encodedRepo=sub.includes(EXPECTED.repository.replace("/","%2F"));
 const hasEnv=sub.includes(EXPECTED.environment);
 const hasWorkflow=sub.includes("job_workflow_ref");
 return {
  valid:true,
  standard,
  prefixClass:prefix==="repo"?"REPO":prefix==="repository_id"?"REPOSITORY_ID":prefix==="job_workflow_ref"?"JOB_WORKFLOW_REF":"OTHER",
  segmentCountBucket:segments.length<=3?"1_TO_3":segments.length<=6?"4_TO_6":"7_PLUS",
  knownKeys:labels.filter((x,i)=>labels.indexOf(x)===i).sort(),
  repositoryLiteralPresent:hasRepo,
  repositoryEncodedPresent:encodedRepo,
  environmentLiteralPresent:hasEnv,
  jobWorkflowRefPresent:hasWorkflow,
  colonEncodedPresent:/%3a/i.test(sub),
  slashEncodedPresent:/%2f/i.test(sub)
 };
}
function requestOidc(){
 return new Promise((resolve,reject)=>{
  const raw=process.env.ACTIONS_ID_TOKEN_REQUEST_URL, bearer=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if(!raw||!bearer)return reject(Error("OIDC_CONTEXT_MISSING"));
  const url=new URL(raw);
  if(url.protocol!=="https:"||!(url.hostname==="token.actions.githubusercontent.com"||url.hostname.endsWith(".actions.githubusercontent.com")))return reject(Error("OIDC_ENDPOINT_REJECTED"));
  url.searchParams.set("audience",AUDIENCE);
  const req=https.get(url,{headers:{Authorization:"Bearer "+bearer}},res=>{
   let body="";
   res.on("data",chunk=>{body+=chunk;if(body.length>65536)req.destroy(Error("OIDC_RESPONSE_TOO_LARGE"));});
   res.on("end",()=>{try{if(res.statusCode!==200)throw Error("OIDC_FETCH_FAILED");resolve(JSON.parse(body).value);}catch(e){reject(e);}});
  });
  req.setTimeout(15000,()=>req.destroy(Error("OIDC_FETCH_TIMEOUT")));
  req.on("error",reject);
 });
}
async function main(){
 if(process.env.BOUSTIO_PHASE1734_APPROVAL!=="INSPECT_SUBJECT_STRUCTURE"||
 process.env.GITHUB_REPOSITORY!==EXPECTED.repository||
 process.env.GITHUB_REF!==EXPECTED.ref){
  console.log("Phase 17.34: CONFIGURATION_REJECTED");process.exitCode=1;return;
 }
 try{
  const claims=decodePayload(await requestOidc());
  const result=inspectSubject(claims.sub);
  if(!result.valid)throw Error("SUBJECT_INVALID");
  for(const [key,value] of Object.entries(result)){
   if(key==="valid")continue;
   console.log("Phase 17.34: "+key.toUpperCase()+" "+(Array.isArray(value)?value.join(",")||"NONE":typeof value==="boolean"?(value?"YES":"NO"):value));
  }
  console.log("Phase 17.34: REPOSITORY_CLAIM "+(claims.repository===EXPECTED.repository?"MATCH":"MISMATCH"));
  console.log("Phase 17.34: ENVIRONMENT_CLAIM "+(claims.environment===EXPECTED.environment?"MATCH":"MISMATCH"));
  console.log("Phase 17.34: REF_CLAIM "+(claims.ref===EXPECTED.ref?"MATCH":"MISMATCH"));
  if(result.standard)console.log("Phase 17.34: EXPECTED_SUBJECT_CONFIRMED");
  else console.log("Phase 17.34: CUSTOMIZATION_POSSIBLE_NOT_PROVEN");
 }catch(e){
  const safe=["OIDC_CONTEXT_MISSING","OIDC_ENDPOINT_REJECTED","OIDC_RESPONSE_TOO_LARGE","OIDC_FETCH_FAILED","OIDC_FETCH_TIMEOUT","SUBJECT_INVALID"];
  console.log("Phase 17.34: ERROR "+(safe.includes(e.message)?e.message:"UNEXPECTED_ERROR"));process.exitCode=1;
 }
 console.log("Phase 17.34: NO_RAW_SUBJECT_NO_TOKEN_NO_CLOUD_API_NO_WRITES");
}
if(require.main===module)main();
module.exports={inspectSubject};
