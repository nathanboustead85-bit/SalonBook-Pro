"use strict";
// Phase 17.6: distinguish federation STS from service-account impersonation.
// Never logs access tokens, credential contents, raw API errors, or customer data.
const fs=require("node:fs");
const {classify}=require("./phase175_auth_diagnostic");
const expected="boustio-readonly-verifier@salonbook-pro-ad5ff.iam.gserviceaccount.com";
const target="https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/"+expected+":generateAccessToken";
const result=(stage,status,category="none")=>Object.freeze({stage,status,category,tokenPrinted:false,firestoreAccessed:false,bookingsEnabled:false});
async function diagnose({env=process.env,loadCredentials,exchange}={}){
 if(env.BOUSTIO_PHASE176_APPROVED!=="true"||env.FIRESTORE_EMULATOR_HOST)
  return [result("CONFIGURATION","DISABLED")];
 if(env.BOUSTIO_FIREBASE_PROJECT_ID!=="salonbook-pro-ad5ff"||!env.GOOGLE_APPLICATION_CREDENTIALS)
  return [result("CONFIGURATION","REJECTED")];
 let credentials;
 try{
  credentials=loadCredentials?await loadCredentials(env.GOOGLE_APPLICATION_CREDENTIALS):
   JSON.parse(fs.readFileSync(env.GOOGLE_APPLICATION_CREDENTIALS,"utf8"));
 }catch(e){return [result("CONFIGURATION","REJECTED","CREDENTIAL_FILE_UNAVAILABLE")];}
 if(credentials?.type!=="external_account"||credentials.service_account_impersonation_url!==target||
    !credentials.credential_source||!credentials.audience)
  return [result("CONFIGURATION","REJECTED","UNEXPECTED_CREDENTIAL_TARGET")];
 // Only remove the impersonation URL in memory to isolate the STS token exchange.
 const direct={...credentials};
 delete direct.service_account_impersonation_url;
 const authExchange=exchange||(async (json)=>{
  const {GoogleAuth}=require("../functions/node_modules/google-auth-library");
  const auth=new GoogleAuth({scopes:["https://www.googleapis.com/auth/cloud-platform"]});
  const client=auth.fromJSON(json,{scopes:["https://www.googleapis.com/auth/cloud-platform"]});
  return client.getAccessToken();
 });
 const attempt=async(stage,json)=>{
  try{
   const response=await authExchange(json,stage);
   const token=typeof response==="string"?response:response?.token;
   return result(stage,typeof token==="string"&&token.length>20?"PASS":"FAIL",
    typeof token==="string"&&token.length>20?"none":"NO_TOKEN");
  }catch(e){return result(stage,"FAIL",classify(e));}
 };
 const sts=await attempt("FEDERATED_STS_EXCHANGE",direct);
 if(sts.status!=="PASS")return [sts,result("SERVICE_ACCOUNT_IMPERSONATION","NOT_ATTEMPTED")];
 const impersonation=await attempt("SERVICE_ACCOUNT_IMPERSONATION",credentials);
 return [sts,impersonation];
}
if(require.main===module){
 diagnose().then(results=>{
  for(const r of results)console.log("Phase 17.6:",r.stage,r.status,r.category,
   "token printed:",r.tokenPrinted,"Firestore accessed:",r.firestoreAccessed,"bookings enabled:",r.bookingsEnabled);
  if(results.length!==2||results.some(r=>r.status!=="PASS"))process.exitCode=1;
 }).catch(()=>{console.log("Phase 17.6: DIAGNOSTIC_FAILED_SAFELY");process.exitCode=1;});
}
module.exports={diagnose};
