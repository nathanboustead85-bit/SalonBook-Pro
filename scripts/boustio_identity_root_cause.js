"use strict";
const https=require("node:https");
const crypto=require("node:crypto");
const {decodePayload,EXPECTED}=require("./phase1732_oidc_claims");
const AUDIENCE="projects/107806967630/locations/global/workloadIdentityPools/boustio-github/providers/github-development-deploy";
function get(url,headers){
 return new Promise((resolve,reject)=>{
  const req=https.get(url,{headers},res=>{
   let data="";res.on("data",c=>{data+=c;if(data.length>65536)req.destroy(Error("RESPONSE_TOO_LARGE"));});
   res.on("end",()=>resolve({status:res.statusCode,data}));
  });
  req.setTimeout(15000,()=>req.destroy(Error("REQUEST_TIMEOUT")));req.on("error",reject);
 });
}
function shape(subject,claims){
 const prefix="repo:",suffix=":environment:"+EXPECTED.environment;
 if(typeof subject!=="string"||!subject.startsWith(prefix)||!subject.endsWith(suffix))return {valid:false};
 const id=subject.slice(prefix.length,-suffix.length);
 const parts=id.split("@");
 const claimValues={
  REPOSITORY:claims.repository,
  WORKFLOW_REF:claims.workflow_ref,
  JOB_WORKFLOW_REF:claims.job_workflow_ref,
  REPOSITORY_AT_REF:claims.repository+"@"+claims.ref,
  REPOSITORY_AT_SHA:claims.repository+"@"+claims.sha,
  WORKFLOW_NAME:claims.workflow,
  ACTOR:claims.actor,
  REPOSITORY_ID:claims.repository_id
 };
 const matches=Object.entries(claimValues).filter(([,v])=>typeof v==="string"&&v===id).map(([k])=>k);
 const repoPart=parts[0];
 const atSuffix=parts.length>1?parts.slice(1).join("@"):"";
 const matchSuffix=Object.entries(claimValues).filter(([,v])=>typeof v==="string"&&v===atSuffix).map(([k])=>k);
 const repoCandidates=[claims.repository,claims.repository?.toLowerCase(),claims.repository?.replace("/","-"),claims.repository_id];
 const repositoryPartMatches=repoCandidates.some(v=>v&&repoPart===v);
 const structure=id.replace(/[A-Za-z0-9]/g,"x").slice(0,180);
 return {valid:true,matches,matchSuffix,repositoryPartMatches,containsAt:parts.length>1,atCount:parts.length-1,repoPartSlashCount:(repoPart.match(/\//g)||[]).length,
  idStructure:structure,identifierDigest:crypto.createHash("sha256").update(id).digest("hex").slice(0,12)};
}
function classifySettings(status,body){
 if(status!==200)return "HTTP_"+status;
 try{const data=JSON.parse(body);return typeof data.use_default==="boolean"?(data.use_default?"DEFAULT":"CUSTOM"):"UNRECOGNIZED";}catch{return "NON_JSON";}
}
async function main(){
 if(process.env.BOUSTIO_IDENTITY_APPROVAL!=="INSPECT_IDENTITY_ONCE"||process.env.GITHUB_REPOSITORY!==EXPECTED.repository||process.env.GITHUB_REF!==EXPECTED.ref){
  console.log("Boustio identity: CONFIGURATION_REJECTED");process.exitCode=1;return;
 }
 try{
  const requestUrl=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL||"");
  if(requestUrl.protocol!=="https:"||!(requestUrl.hostname==="token.actions.githubusercontent.com"||requestUrl.hostname.endsWith(".actions.githubusercontent.com")))throw Error("OIDC_ENDPOINT_REJECTED");
  requestUrl.searchParams.set("audience",AUDIENCE);
  const oidc=await get(requestUrl,{Authorization:"Bearer "+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN});
  if(oidc.status!==200)throw Error("OIDC_FETCH_FAILED");
  const claims=decodePayload(JSON.parse(oidc.data).value);
  const result=shape(claims.sub,claims);
  if(!result.valid)throw Error("UNEXPECTED_SUBJECT_STRUCTURE");
  for(const [key,value] of Object.entries(result)){
   if(key==="valid")continue;
   console.log("Boustio identity: "+key.toUpperCase()+" "+(Array.isArray(value)?value.join(",")||"NONE":value));
  }
  for(const key of ["repository","ref","environment"]){
   console.log("Boustio identity: "+key.toUpperCase()+"_CLAIM "+(claims[key]===EXPECTED[key]?"MATCH":"MISMATCH"));
  }
  const githubToken=process.env.GITHUB_TOKEN;
  if(githubToken){
   const headers={Accept:"application/vnd.github+json",Authorization:"Bearer "+githubToken,"X-GitHub-Api-Version":"2022-11-28","User-Agent":"boustio-readonly-identity"};
   const org=EXPECTED.repository.split("/")[0];
   const orgRes=await get("https://api.github.com/orgs/"+org+"/actions/oidc/customization/sub",headers);
   console.log("Boustio identity: ORG_SETTINGS "+classifySettings(orgRes.status,orgRes.data));
   const repoRes=await get("https://api.github.com/repos/"+EXPECTED.repository+"/actions/oidc/customization/sub",headers);
   console.log("Boustio identity: REPO_SETTINGS "+classifySettings(repoRes.status,repoRes.data));
  }
 }catch(e){
  const allowed=["OIDC_ENDPOINT_REJECTED","OIDC_FETCH_FAILED","UNEXPECTED_SUBJECT_STRUCTURE","RESPONSE_TOO_LARGE","REQUEST_TIMEOUT"];
  console.log("Boustio identity: ERROR "+(allowed.includes(e.message)?e.message:"DIAGNOSTIC_FAILED"));process.exitCode=1;
 }
 console.log("Boustio identity: NO_RAW_SUBJECT_NO_TOKEN_NO_CLOUD_CHANGES_NO_WRITES");
}
if(require.main===module)main();
module.exports={shape,classifySettings};
