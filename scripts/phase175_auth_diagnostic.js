"use strict";
// Phase 17.5: isolated, opt-in credential diagnostic. Never prints tokens or raw errors.
// No Firestore operations, IAM changes, deployments, or booking writes.
const fs=require("node:fs");
function classify(error){
 const code=error&&error.code;
 const status=error&&error.response&&error.response.status;
 if(code===403||status===403)return "ACCESS_DENIED";
 if(code===401||status===401)return "UNAUTHENTICATED";
 const message=typeof error?.message==="string"?error.message.slice(0,2000):"";
 if(/iamcredentials|iam\\.serviceAccounts\\.getAccessToken|generateAccessToken|iam\\.serviceAccounts\\.getOpenIdToken/i.test(message))
  return "IMPERSONATION_DENIED_OR_IAM_API";
 if(/invalid_grant|invalid_target|invalid_subject_token|invalid_credential/i.test(message))
  return "FEDERATED_TOKEN_REJECTED";
 if(/403|permission denied|PERMISSION_DENIED/i.test(message))return "ACCESS_DENIED";
 if(/401|UNAUTHENTICATED/i.test(message))return "UNAUTHENTICATED";
 if(/ENOTFOUND|ETIMEDOUT|ECONNRESET|UNAVAILABLE/i.test(message))return "NETWORK_OR_SERVICE_UNAVAILABLE";
 return "UNKNOWN_AUTH_ERROR";
}
async function verify({env=process.env,loadCredentials,requestToken}={}){
 const deny=(status,category="none")=>Object.freeze({status,category,tokenPrinted:false,firestoreAccessed:false,bookingsEnabled:false});
 if(env.BOUSTIO_PHASE175_APPROVED!=="true"||env.FIRESTORE_EMULATOR_HOST)
  return deny("AUTH_DIAGNOSTIC_DISABLED");
 const expected="boustio-readonly-verifier@salonbook-pro-ad5ff.iam.gserviceaccount.com";
 const credentialsPath=env.GOOGLE_APPLICATION_CREDENTIALS;
 if(!credentialsPath||!env.BOUSTIO_FIREBASE_PROJECT_ID||
    env.BOUSTIO_FIREBASE_PROJECT_ID!=="salonbook-pro-ad5ff")
  return deny("AUTH_DIAGNOSTIC_CONFIGURATION_REJECTED");
 try{
  const credentials=loadCredentials?await loadCredentials(credentialsPath):
   JSON.parse(fs.readFileSync(credentialsPath,"utf8"));
  if(credentials.type!=="external_account"||
     credentials.service_account_impersonation_url!==
      "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/"+
      expected+":generateAccessToken")
   return deny("AUTH_DIAGNOSTIC_CREDENTIAL_TARGET_REJECTED");
  const token=requestToken?await requestToken():
   await (async()=>{
    const {GoogleAuth}=require("../functions/node_modules/google-auth-library");
    const client=await new GoogleAuth({scopes:["https://www.googleapis.com/auth/cloud-platform"]}).getClient();
    return client.getAccessToken();
   })();
  const value=typeof token==="string"?token:token&&token.token;
  if(typeof value!=="string"||value.length<20)
   return deny("AUTH_DIAGNOSTIC_TOKEN_NOT_ISSUED");
  return deny("AUTH_DIAGNOSTIC_TOKEN_ISSUED");
 }catch(error){return deny("AUTH_DIAGNOSTIC_REVIEW_REQUIRED",classify(error));}
}
if(require.main===module){
 verify().then(result=>{
  console.log("Phase 17.5:",result.status,"failure category:",result.category,
   "token printed:",result.tokenPrinted,"Firestore accessed:",result.firestoreAccessed,
   "bookings enabled:",result.bookingsEnabled);
  if(result.status!=="AUTH_DIAGNOSTIC_TOKEN_ISSUED")process.exitCode=1;
 }).catch(()=>{console.log("Phase 17.5: AUTH_DIAGNOSTIC_REVIEW_REQUIRED");process.exitCode=1;});
}
module.exports={verify,classify};
