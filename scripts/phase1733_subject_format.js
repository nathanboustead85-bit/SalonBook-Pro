"use strict";
const https=require("node:https");
const {decodePayload,EXPECTED}=require("./phase1732_oidc_claims");
const AUDIENCE="projects/107806967630/locations/global/workloadIdentityPools/boustio-github/providers/github-development-deploy";
function describeSubject(sub){
 if(typeof sub!=="string")return {format:"ABSENT",repoPrefix:false,environmentSegment:false,exactEnvironment:false,exactSubject:false};
 const prefix="repo:"+EXPECTED.repository+":";
 const repoPrefix=sub.startsWith(prefix);
 const tail=repoPrefix?sub.slice(prefix.length):"";
 const format=repoPrefix&&tail.startsWith("environment:")?"ENVIRONMENT":
 repoPrefix&&tail.startsWith("ref:")?"BRANCH_REF":
 repoPrefix&&tail==="pull_request"?"PULL_REQUEST":
 sub.startsWith("repo:")?"OTHER_REPOSITORY_OR_CUSTOM":"CUSTOM_OR_UNKNOWN";
 return {format,repoPrefix,environmentSegment:tail.startsWith("environment:"),exactEnvironment:tail==="environment:"+EXPECTED.environment,exactSubject:sub===EXPECTED.sub};
}
function isAllowedOidcEndpoint(url){\n return url.protocol==="https:" && (url.hostname==="token.actions.githubusercontent.com" || url.hostname.endsWith(".actions.githubusercontent.com"));\n}\nfunction fetchToken(){
 return new Promise((resolve,reject)=>{
  const urlText=process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const bearer=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if(!urlText||!bearer)return reject(Error("OIDC_CONTEXT_MISSING"));
  const url=new URL(urlText);
  if(!isAllowedOidcEndpoint(url))return reject(Error("OIDC_ENDPOINT_REJECTED"));
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
 if(process.env.BOUSTIO_PHASE1733_APPROVAL!=="CHECK_SUBJECT_FORMAT"||
 process.env.GITHUB_REPOSITORY!==EXPECTED.repository||
 process.env.GITHUB_REF!==EXPECTED.ref){
  console.log("Phase 17.33: CONFIGURATION_REJECTED");process.exitCode=1;return;
 }
 try{
  const claims=decodePayload(await fetchToken());
  const result=describeSubject(claims.sub);
  for(const [k,v] of Object.entries(result))console.log("Phase 17.33: "+k.toUpperCase()+" "+(typeof v==="boolean"?(v?"YES":"NO"):v));
  console.log("Phase 17.33: CLAIM_REPOSITORY "+(claims.repository===EXPECTED.repository?"MATCH":"MISMATCH"));
  console.log("Phase 17.33: CLAIM_ENVIRONMENT "+(claims.environment===EXPECTED.environment?"MATCH":"MISMATCH"));
  console.log("Phase 17.33: CLAIM_REF "+(claims.ref===EXPECTED.ref?"MATCH":"MISMATCH"));
  if(!result.exactSubject)process.exitCode=1;
 }catch(e){
  const safe=["OIDC_CONTEXT_MISSING","OIDC_ENDPOINT_REJECTED","OIDC_RESPONSE_TOO_LARGE","OIDC_FETCH_FAILED","OIDC_FETCH_TIMEOUT","OIDC_TOKEN_FORMAT_INVALID"];
  console.log("Phase 17.33: ERROR "+(safe.includes(e.message)?e.message:"UNEXPECTED_ERROR"));
  process.exitCode=1;
 }
 console.log("Phase 17.33: NO_RAW_SUBJECT_NO_TOKEN_NO_CLOUD_API_NO_WRITES");
}
if(require.main===module)main();
module.exports={describeSubject,isAllowedOidcEndpoint};
