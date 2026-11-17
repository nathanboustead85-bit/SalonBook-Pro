"use strict";
// Phase 17.8: categorize the GitHub OIDC subject without printing token or claim values.
const https=require("node:https");
const provider="projects/107806967630/locations/global/workloadIdentityPools/boustio-github/providers/github-readonly";
const repository="nathanboustead85-bit/SalonBook-Pro";
const environment="boustio-readonly-verification";
const ref="refs/heads/milestone-customer-booking-experience";
const expected="repo:"+repository+":environment:"+environment;
function categorize(c){
 if(!c||typeof c.sub!=="string")return "SUBJECT_MISSING";
 if(c.sub===expected)return "EXPECTED_ENVIRONMENT_SUBJECT";
 if(c.sub==="repo:"+repository+":ref:"+ref)return "BRANCH_REF_SUBJECT";
 if(c.sub==="repo:"+repository+":pull_request")return "PULL_REQUEST_SUBJECT";
 if(c.sub.startsWith("repo:"+repository+":environment:"))return "DIFFERENT_ENVIRONMENT_SUBJECT";
 if(c.sub.startsWith("repo:"+repository+":ref:"))return "DIFFERENT_REF_SUBJECT";
 if(c.sub.startsWith("repo:"+repository+":"))return "CUSTOM_OR_OTHER_REPOSITORY_SUBJECT";
 return "UNRECOGNIZED_SUBJECT";
}
function compare(c,env){
 return {
  subjectCategory:categorize(c),
  repository:c.repository===repository&&env.GITHUB_REPOSITORY===repository?"MATCH":"MISMATCH",
  ref:c.ref===ref&&env.GITHUB_REF===ref?"MATCH":"MISMATCH",
  environment:c.environment===environment?"MATCH":"MISMATCH",
  issuer:c.iss==="https://token.actions.githubusercontent.com"?"MATCH":"MISMATCH",
  audience:c.aud===provider?"MATCH":"MISMATCH",
  subjectMatchesExpected:c.sub===expected
 };
}
async function fetchToken(env,request){
 if(!env.ACTIONS_ID_TOKEN_REQUEST_URL||!env.ACTIONS_ID_TOKEN_REQUEST_TOKEN)throw Error("OIDC_UNAVAILABLE");
 const url=new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL);
 url.searchParams.set("audience",provider);
 if(url.protocol!=="https:"||!url.hostname.endsWith(".actions.githubusercontent.com"))throw Error("OIDC_ENDPOINT_INVALID");
 if(request)return request(url,{"Authorization":"Bearer "+env.ACTIONS_ID_TOKEN_REQUEST_TOKEN});
 return new Promise((resolve,reject)=>{
  const req=https.get(url,{"headers":{"Authorization":"Bearer "+env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}},res=>{
   let body="";
   res.on("data",c=>{body+=c;if(body.length>100000)req.destroy(Error("RESPONSE_TOO_LARGE"));});
   res.on("end",()=>{if(res.statusCode!==200)return reject(Error("OIDC_DENIED"));try{resolve(JSON.parse(body).value);}catch(e){reject(Error("INVALID_OIDC_RESPONSE"));}});
  });req.on("error",reject);
 });
}
async function run({env=process.env,request}={}){
 if(env.BOUSTIO_PHASE178_APPROVED!=="true"||env.FIRESTORE_EMULATOR_HOST)return {status:"DISABLED"};
 try{
  const token=await fetchToken(env,request);
  if(typeof token!=="string"||token.split(".").length!==3)throw Error("INVALID_TOKEN");
  const claims=JSON.parse(Buffer.from(token.split(".")[1],"base64url").toString("utf8"));
  const comparison=compare(claims,env);
  return {status:comparison.subjectMatchesExpected?"EXPECTED_SUBJECT":"SUBJECT_VARIATION_FOUND",comparison};
 }catch(e){return {status:"DIAGNOSTIC_UNAVAILABLE"};}
}
if(require.main===module)run().then(r=>{
 console.log("Phase 17.8:",r.status);
 if(r.comparison){
  for(const key of ["subjectCategory","repository","ref","environment","issuer","audience"])
   console.log("Phase 17.8:",key.toUpperCase(),r.comparison[key]);
 }
 console.log("Phase 17.8: IAM_POLICY_NOT_READ; NO_PERMISSIONS_CHANGED; NO_FIRESTORE_ACCESS; NO_TOKEN_OUTPUT");
 if(!["EXPECTED_SUBJECT","SUBJECT_VARIATION_FOUND"].includes(r.status))process.exitCode=1;
}).catch(()=>{console.log("Phase 17.8: DIAGNOSTIC_UNAVAILABLE");process.exitCode=1;});
module.exports={categorize,compare,run};
