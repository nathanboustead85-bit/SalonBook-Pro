"use strict";
// Phase 17.10: compare repository subject component with safe known encodings.
const https=require("node:https");
const provider="projects/107806967630/locations/global/workloadIdentityPools/boustio-github/providers/github-readonly";
const expectedRepo="nathanboustead85-bit/SalonBook-Pro";
const expectedEnv="boustio-readonly-verification";
function classify(claims){
 const sub=typeof claims?.sub==="string"?claims.sub:"";
 const m=/^repo:([^:]*):environment:([^:]*)$/.exec(sub);
 if(!m)return {structure:"OTHER_SUBJECT_STRUCTURE",repositoryFormat:"NOT_EVALUATED",environment:"NOT_EVALUATED"};
 const raw=m[1],environment=m[2];
 let decoded;
 try{decoded=decodeURIComponent(raw);}catch(e){decoded=null;}
 let format="OTHER_REPOSITORY_REPRESENTATION";
 if(raw===expectedRepo)format="EXACT_REPOSITORY";
 else if(decoded===expectedRepo)format="PERCENT_ENCODED_REPOSITORY";
 else if(raw.toLowerCase()===expectedRepo.toLowerCase())format="CASE_ONLY_VARIATION";
 else if(raw===expectedRepo.replace("/","%2F"))format="ENCODED_SLASH";
 else if(raw===expectedRepo.replace("/","_"))format="UNDERSCORE_SEPARATOR";
 else if(raw===expectedRepo.split("/")[1])format="REPOSITORY_NAME_ONLY";
 else if(raw===expectedRepo.split("/")[0])format="OWNER_NAME_ONLY";
 else if(raw===encodeURIComponent(expectedRepo))format="URL_ENCODED_REPOSITORY";
 return {structure:"REPO_ENVIRONMENT_STRUCTURE",repositoryFormat:format,
  environment:environment===expectedEnv?"MATCH":"MISMATCH",
  repositoryClaim:claims.repository===expectedRepo?"MATCH":"MISMATCH",
  repoComponentEmpty:raw.length===0?"YES":"NO",
  containsPercentEncoding:/%[0-9a-fA-F]{2}/.test(raw)?"YES":"NO",
  hasSlash:raw.includes("/")?"YES":"NO"};
}
async function run({env=process.env,request}={}){
 if(env.BOUSTIO_PHASE1710_APPROVED!=="true"||env.FIRESTORE_EMULATOR_HOST)return {status:"DISABLED"};
 try{
  if(!env.ACTIONS_ID_TOKEN_REQUEST_URL||!env.ACTIONS_ID_TOKEN_REQUEST_TOKEN)throw Error("NO_OIDC");
  const url=new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL);
  url.searchParams.set("audience",provider);
  if(url.protocol!=="https:"||!url.hostname.endsWith(".actions.githubusercontent.com"))throw Error("BAD_ENDPOINT");
  const token=await (request?request(url,{"Authorization":"Bearer "+env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}):
   new Promise((resolve,reject)=>{
    const req=https.get(url,{headers:{"Authorization":"Bearer "+env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}},res=>{
     let data="";
     res.on("data",c=>{data+=c;if(data.length>100000)req.destroy(Error("TOO_LARGE"));});
     res.on("end",()=>{if(res.statusCode!==200)return reject(Error("OIDC_DENIED"));try{resolve(JSON.parse(data).value);}catch(e){reject(Error("BAD_RESPONSE"));}});
    });req.on("error",reject);
   }));
  if(typeof token!=="string"||token.split(".").length!==3)throw Error("BAD_TOKEN");
  const claims=JSON.parse(Buffer.from(token.split(".")[1],"base64url").toString("utf8"));
  return {status:"INSPECTED",report:classify(claims)};
 }catch(e){return {status:"DIAGNOSTIC_UNAVAILABLE"};}
}
if(require.main===module)run().then(r=>{
 console.log("Phase 17.10:",r.status);
 if(r.report)for(const [k,v] of Object.entries(r.report))console.log("Phase 17.10:",k,v);
 console.log("Phase 17.10: IAM_POLICY_NOT_READ; NO_PERMISSIONS_CHANGED; NO_FIRESTORE_ACCESS; NO_TOKEN_OUTPUT");
 if(r.status!=="INSPECTED")process.exitCode=1;
}).catch(()=>{console.log("Phase 17.10: DIAGNOSTIC_UNAVAILABLE");process.exitCode=1;});
module.exports={classify,run};
