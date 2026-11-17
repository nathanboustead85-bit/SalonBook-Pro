"use strict";
// Phase 17.7: inspect GitHub OIDC identity and expected IAM principal locally.
// No token/claim values printed, no Google Cloud IAM or Firestore API calls.
const https=require("node:https");
const expectedSub="repo:nathanboustead85-bit/SalonBook-Pro:environment:boustio-readonly-verification";
const expectedIssuer="https://token.actions.githubusercontent.com";
const expectedPrincipal="principal://iam.googleapis.com/projects/107806967630/locations/global/workloadIdentityPools/boustio-github/subject/"+expectedSub;
const expectedProvider="projects/107806967630/locations/global/workloadIdentityPools/boustio-github/providers/github-readonly";
function assess({env,claims}){
 const rows=[];
 const check=(name,ok)=>rows.push({name,status:ok?"MATCH":"MISMATCH"});
 check("REPOSITORY",env.GITHUB_REPOSITORY==="nathanboustead85-bit/SalonBook-Pro"&&claims.repository===env.GITHUB_REPOSITORY);
 check("BRANCH",env.GITHUB_REF==="refs/heads/milestone-customer-booking-experience"&&claims.ref===env.GITHUB_REF);
 check("SUBJECT",claims.sub===expectedSub);
 check("ENVIRONMENT",claims.environment==="boustio-readonly-verification");
 check("ISSUER",claims.iss===expectedIssuer);
 check("AUDIENCE",claims.aud===expectedProvider);
 check("IAM_PRINCIPAL_SHAPE",expectedPrincipal.endsWith("/subject/"+claims.sub));
 return rows;
}
function getToken(env,request){
 return new Promise((resolve,reject)=>{
  if(!env.ACTIONS_ID_TOKEN_REQUEST_URL||!env.ACTIONS_ID_TOKEN_REQUEST_TOKEN)return reject(Error("OIDC_NOT_AVAILABLE"));
  const url=new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL);
  url.searchParams.set("audience",expectedProvider);
  if(url.protocol!=="https:"||url.hostname!=="pipelines.actions.githubusercontent.com"&&!url.hostname.endsWith(".actions.githubusercontent.com"))
   return reject(Error("OIDC_ENDPOINT_REJECTED"));
  const invoke=request||((url,headers)=>new Promise((done,fail)=>{
   const req=https.get(url,{headers},res=>{
    let body="";
    res.on("data",c=>{body+=c;if(body.length>100000)req.destroy(Error("RESPONSE_TOO_LARGE"));});
    res.on("end",()=>{if(res.statusCode!==200)return fail(Error("OIDC_HTTP_REJECTED"));try{done(JSON.parse(body).value);}catch(e){fail(Error("OIDC_RESPONSE_INVALID"));}});
   });req.on("error",fail);
  }));
  invoke(url,{"Authorization":"Bearer "+env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}).then(resolve,reject);
 });
}
async function run({env=process.env,request}={}){
 if(env.BOUSTIO_PHASE177_APPROVED!=="true"||env.FIRESTORE_EMULATOR_HOST)return {status:"DISABLED",checks:[]};
 try{
  const token=await getToken(env,request);
  if(typeof token!=="string")throw Error("OIDC_TOKEN_INVALID");
  const parts=token.split(".");
  if(parts.length!==3)throw Error("OIDC_TOKEN_INVALID");
  const claims=JSON.parse(Buffer.from(parts[1],"base64url").toString("utf8"));
  const checks=assess({env,claims});
  return {status:checks.every(c=>c.status==="MATCH")?"IDENTITY_MATCH":"IDENTITY_MISMATCH",checks};
 }catch(e){return {status:"DIAGNOSTIC_UNAVAILABLE",checks:[]};}
}
if(require.main===module)run().then(r=>{
 console.log("Phase 17.7:",r.status);
 for(const c of r.checks)console.log("Phase 17.7:",c.name,c.status);
 console.log("Phase 17.7: IAM_POLICY_NOT_READ; NO_PERMISSIONS_CHANGED; NO_FIRESTORE_ACCESS");
 if(r.status!=="IDENTITY_MATCH")process.exitCode=1;
}).catch(()=>{console.log("Phase 17.7: DIAGNOSTIC_UNAVAILABLE");process.exitCode=1;});
module.exports={assess,run};
