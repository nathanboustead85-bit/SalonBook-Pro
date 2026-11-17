"use strict";
const https=require("node:https");
const {decodePayload,EXPECTED}=require("./phase1732_oidc_claims");
const AUDIENCE="projects/107806967630/locations/global/workloadIdentityPools/boustio-github/providers/github-development-deploy";
function classify(sub,claims){
 if(typeof sub!=="string"||sub.length>4096)return {valid:false};
 const parts=sub.split(":");
 if(parts[0]!=="repo"||parts.length<4)return {valid:false};
 const identifier=parts[1];
 const repo=EXPECTED.repository;
 const repoId=String(claims.repository_id||"");
 const owner=repo.split("/")[0],name=repo.split("/")[1];
 const matches={
  EXPECTED_EXACT:identifier===repo,
  EXPECTED_CASE_INSENSITIVE:identifier.toLowerCase()===repo.toLowerCase(),
  REPOSITORY_ID:!!repoId&&identifier===repoId,
  REPOSITORY_ID_PREFIX:!!repoId&&identifier==="repository_id/"+repoId,
  OWNER_ONLY:identifier===owner,
  NAME_ONLY:identifier===name,
  URL_ENCODED:identifier===encodeURIComponent(repo),
  DASH_SEPARATED:identifier===repo.replace("/","-"),
  UNDERSCORE_SEPARATED:identifier===repo.replace("/","_"),
  CLAIM_REPOSITORY_EXACT:identifier===claims.repository,
  CLAIM_REPOSITORY_CASE_INSENSITIVE:typeof claims.repository==="string"&&identifier.toLowerCase()===claims.repository.toLowerCase()
 };
 const segmentType=parts[2]==="environment"?"ENVIRONMENT":parts[2]==="ref"?"REF":"OTHER";
 const suffixMatches=parts.slice(3).join(":")===EXPECTED.environment;
 const matchNames=Object.keys(matches).filter(k=>matches[k]);
 return {valid:true,matchNames,identifierLengthBucket:identifier.length<=12?"1_TO_12":identifier.length<=30?"13_TO_30":"31_PLUS",identifierHasSlash:identifier.includes("/"),identifierHasDigits:/[0-9]/.test(identifier),identifierHasUppercase:/[A-Z]/.test(identifier),identifierHasAt:identifier.includes("@"),segmentType,environmentSuffixMatches:suffixMatches,claimRepositoryIdPresent:!!repoId,claimRepositoryMatches:claims.repository===repo};
}
function getToken(){
 return new Promise((resolve,reject)=>{
  const endpoint=process.env.ACTIONS_ID_TOKEN_REQUEST_URL,secret=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if(!endpoint||!secret)return reject(Error("OIDC_CONTEXT_MISSING"));
  const url=new URL(endpoint);
  if(url.protocol!=="https:"||!(url.hostname==="token.actions.githubusercontent.com"||url.hostname.endsWith(".actions.githubusercontent.com")))return reject(Error("OIDC_ENDPOINT_REJECTED"));
  url.searchParams.set("audience",AUDIENCE);
  const req=https.get(url,{headers:{Authorization:"Bearer "+secret}},res=>{
   let data="";
   res.on("data",chunk=>{data+=chunk;if(data.length>65536)req.destroy(Error("OIDC_RESPONSE_TOO_LARGE"));});
   res.on("end",()=>{try{if(res.statusCode!==200)throw Error("OIDC_FETCH_FAILED");resolve(JSON.parse(data).value);}catch(e){reject(e);}});
  });
  req.setTimeout(15000,()=>req.destroy(Error("OIDC_FETCH_TIMEOUT")));
  req.on("error",reject);
 });
}
async function main(){
 if(process.env.BOUSTIO_PHASE1735_APPROVAL!=="CLASSIFY_REPOSITORY_ID"||process.env.GITHUB_REPOSITORY!==EXPECTED.repository||process.env.GITHUB_REF!==EXPECTED.ref){
  console.log("Phase 17.35: CONFIGURATION_REJECTED");process.exitCode=1;return;
 }
 try{
  const claims=decodePayload(await getToken());
  const c=classify(claims.sub,claims);
  if(!c.valid)throw Error("SUBJECT_INVALID");
  console.log("Phase 17.35: MATCH_CATEGORIES "+(c.matchNames.join(",")||"NONE"));
  for(const [key,value] of Object.entries(c)){
   if(key==="valid"||key==="matchNames")continue;
   console.log("Phase 17.35: "+key.toUpperCase()+" "+(typeof value==="boolean"?(value?"YES":"NO"):value));
  }
  console.log("Phase 17.35: CLAIM_ENVIRONMENT "+(claims.environment===EXPECTED.environment?"MATCH":"MISMATCH"));
  console.log("Phase 17.35: CLAIM_REF "+(claims.ref===EXPECTED.ref?"MATCH":"MISMATCH"));
  console.log("Phase 17.35: IDENTITY_DIAGNOSTIC_ONLY");
 }catch(e){
  const safe=["OIDC_CONTEXT_MISSING","OIDC_ENDPOINT_REJECTED","OIDC_RESPONSE_TOO_LARGE","OIDC_FETCH_FAILED","OIDC_FETCH_TIMEOUT","SUBJECT_INVALID"];
  console.log("Phase 17.35: ERROR "+(safe.includes(e.message)?e.message:"UNEXPECTED_ERROR"));process.exitCode=1;
 }
 console.log("Phase 17.35: NO_RAW_SUBJECT_NO_TOKEN_NO_CLOUD_API_NO_WRITES");
}
if(require.main===module)main();
module.exports={classify};
