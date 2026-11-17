"use strict";
// Phase 17.12: compare the observed OIDC subject to the exact IAM principal
// confirmed by the owner, without outputting raw subject or token.
const https=require("node:https");
const provider="projects/107806967630/locations/global/workloadIdentityPools/boustio-github/providers/github-readonly";
const expectedOwner="nathanboustead85-bit",expectedName="SalonBook-Pro",expectedEnvironment="boustio-readonly-verification";
const expectedSubject="repo:"+expectedOwner+"/"+expectedName+":environment:"+expectedEnvironment;
function compare(claims){
 const subject=typeof claims?.sub==="string"?claims.sub:"";
 const match=/^repo:([^:]+):environment:([^:]+)$/.exec(subject);
 if(!match)return {structure:"UNEXPECTED",owner:"NOT_EVALUATED",name:"NOT_EVALUATED",environment:"NOT_EVALUATED",subject:"MISMATCH"};
 const repo=match[1],slash=repo.indexOf("/");
 const owner=slash>=0?repo.slice(0,slash):"",name=slash>=0?repo.slice(slash+1):"";
 const category=(value,expected)=>value===expected?"MATCH":value.toLowerCase()===expected.toLowerCase()?"CASE_DIFFERENCE":"DIFFERENT";
 return {structure:"REPO_ENVIRONMENT",owner:category(owner,expectedOwner),name:category(name,expectedName),
  environment:category(match[2],expectedEnvironment),subject:subject===expectedSubject?"MATCH":"MISMATCH",
  repositoryClaim:claims.repository===expectedOwner+"/"+expectedName?"MATCH":"MISMATCH"};
}
async function run({env=process.env,request}={}){
 if(env.BOUSTIO_PHASE1712_APPROVED!=="true"||env.FIRESTORE_EMULATOR_HOST)return {status:"DISABLED"};
 try{
  if(!env.ACTIONS_ID_TOKEN_REQUEST_URL||!env.ACTIONS_ID_TOKEN_REQUEST_TOKEN)throw Error("OIDC_UNAVAILABLE");
  const url=new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL);url.searchParams.set("audience",provider);
  if(url.protocol!=="https:"||!url.hostname.endsWith(".actions.githubusercontent.com"))throw Error("ENDPOINT_INVALID");
  const token=await (request?request(url,{"Authorization":"Bearer "+env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}):
   new Promise((resolve,reject)=>{
    const req=https.get(url,{headers:{"Authorization":"Bearer "+env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}},res=>{
     let body="";res.on("data",chunk=>{body+=chunk;if(body.length>100000)req.destroy(Error("RESPONSE_TOO_LARGE"));});
     res.on("end",()=>{if(res.statusCode!==200)return reject(Error("OIDC_DENIED"));try{resolve(JSON.parse(body).value);}catch(e){reject(Error("INVALID_RESPONSE"));}});
    });req.on("error",reject);
   }));
  if(typeof token!=="string"||token.split(".").length!==3)throw Error("INVALID_TOKEN");
  const claims=JSON.parse(Buffer.from(token.split(".")[1],"base64url").toString("utf8"));
  return {status:"COMPARED",comparison:compare(claims)};
 }catch(e){return {status:"DIAGNOSTIC_UNAVAILABLE"};}
}
if(require.main===module)run().then(r=>{
 console.log("Phase 17.12:",r.status);
 if(r.comparison)for(const [k,v] of Object.entries(r.comparison))console.log("Phase 17.12:",k,v);
 console.log("Phase 17.12: IAM_POLICY_NOT_READ; NO_PERMISSIONS_CHANGED; NO_FIRESTORE_ACCESS; NO_TOKEN_OUTPUT");
 if(r.status!=="COMPARED")process.exitCode=1;
}).catch(()=>{console.log("Phase 17.12: DIAGNOSTIC_UNAVAILABLE");process.exitCode=1;});
module.exports={compare,run};
