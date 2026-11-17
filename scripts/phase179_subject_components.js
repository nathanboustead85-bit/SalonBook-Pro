"use strict";
// Phase 17.9: detect known OIDC subject components without printing tokens or claim values.
const https=require("node:https");
const provider="projects/107806967630/locations/global/workloadIdentityPools/boustio-github/providers/github-readonly";
const repo="nathanboustead85-bit/SalonBook-Pro";
const envName="boustio-readonly-verification";
const expected="repo:"+repo+":environment:"+envName;
const known=["repo","repository","repository_id","repository_owner","repository_owner_id","environment","ref","job_workflow_ref","workflow","context","actor","actor_id"];
function inspect(c){
 const subject=typeof c?.sub==="string"?c.sub:"";
 const segments=subject.split(":");
 const present=known.filter(k=>segments.includes(k));
 const unknownKeyCount=segments.filter((s,i)=>i%2===0&&s&&!known.includes(s)).length;
 const standard=subject===expected;
 return {
  classification:standard?"STANDARD_ENVIRONMENT":"NONSTANDARD_SUBJECT",
  repositoryClaim:c?.repository===repo?"MATCH":"MISMATCH",
  environmentClaim:c?.environment===envName?"MATCH":"MISMATCH",
  issuer:c?.iss==="https://token.actions.githubusercontent.com"?"MATCH":"MISMATCH",
  audience:c?.aud===provider?"MATCH":"MISMATCH",
  subjectHasExpectedRepo:subject.includes(repo)?"YES":"NO",
  subjectHasEnvironment:subject.includes(envName)?"YES":"NO",
  subjectHasJobWorkflowRef:subject.includes("job_workflow_ref")?"YES":"NO",
  subjectHasRepositoryId:subject.includes("repository_id")?"YES":"NO",
  subjectHasRef:segments.includes("ref")?"YES":"NO",
  knownComponents:present.length?present.join(","):"NONE",
  unrecognizedComponentNames:unknownKeyCount?"PRESENT":"NONE",
  subjectEmpty:subject.length===0?"YES":"NO"
 };
}
async function run({env=process.env,request}={}){
 if(env.BOUSTIO_PHASE179_APPROVED!=="true"||env.FIRESTORE_EMULATOR_HOST)return {status:"DISABLED"};
 try{
  if(!env.ACTIONS_ID_TOKEN_REQUEST_URL||!env.ACTIONS_ID_TOKEN_REQUEST_TOKEN)throw Error("OIDC_UNAVAILABLE");
  const url=new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL);
  url.searchParams.set("audience",provider);
  if(url.protocol!=="https:"||!url.hostname.endsWith(".actions.githubusercontent.com"))throw Error("INVALID_ENDPOINT");
  const token=await (request?request(url,{"Authorization":"Bearer "+env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}):
   new Promise((resolve,reject)=>{
    const req=https.get(url,{headers:{"Authorization":"Bearer "+env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}},res=>{
     let data="";
     res.on("data",chunk=>{data+=chunk;if(data.length>100000)req.destroy(Error("TOO_LARGE"));});
     res.on("end",()=>{if(res.statusCode!==200)return reject(Error("OIDC_DENIED"));try{resolve(JSON.parse(data).value);}catch(e){reject(Error("INVALID_RESPONSE"));}});
    });req.on("error",reject);
   }));
  if(typeof token!=="string"||token.split(".").length!==3)throw Error("INVALID_TOKEN");
  const claims=JSON.parse(Buffer.from(token.split(".")[1],"base64url").toString("utf8"));
  return {status:"INSPECTED",report:inspect(claims)};
 }catch(e){return {status:"DIAGNOSTIC_UNAVAILABLE"};}
}
if(require.main===module)run().then(r=>{
 console.log("Phase 17.9:",r.status);
 if(r.report)for(const [key,value] of Object.entries(r.report))console.log("Phase 17.9:",key,value);
 console.log("Phase 17.9: TEMPLATE_CONFIGURATION_NOT_READ; IAM_POLICY_NOT_READ; NO_PERMISSION_CHANGES; NO_FIRESTORE_ACCESS; NO_TOKEN_OUTPUT");
 if(r.status!=="INSPECTED")process.exitCode=1;
}).catch(()=>{console.log("Phase 17.9: DIAGNOSTIC_UNAVAILABLE");process.exitCode=1;});
module.exports={inspect,run};
