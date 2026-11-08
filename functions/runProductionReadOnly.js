"use strict";
/**
 * Phase 10.27 — keyless operator-side verification runner.
 * NO deployment, credentials, archive upload or production access occurs by adding this file.
 * Intended for a trusted ephemeral Google Cloud environment with ADC impersonating
 * the dedicated read-only service account; NEVER use broad admin ADC.
 *
 * Usage (after separate approval and security review):
 * node functions/runProductionReadOnly.js --archive /secure/local/archive.json --owner UID
 */
const fs=require("node:fs");
const admin=require("firebase-admin");
const {GoogleAuth}=require("google-auth-library");
const {verifyProductionReadOnly,EXPECTED_PROJECT}=require("./productionReadOnlyVerification");
const EXPECTED_EMAIL="boustio-readonly-verifier@"+EXPECTED_PROJECT+".iam.gserviceaccount.com";
function fail(message){process.stderr.write("BLOCKED: "+message+"\n");process.exitCode=1;}
async function main({argv=process.argv.slice(2),env=process.env}={}){
 if(env.GITHUB_ACTIONS||env.FIRESTORE_EMULATOR_HOST)
  throw Error("Production verifier prohibited in GitHub Actions or emulator");
 if(argv.length!==4||argv[0]!=="--archive"||argv[2]!=="--owner")
  throw Error("Expected --archive PRIVATE_FILE --owner VERIFIED_UID");
 const [archivePath,owner]=[argv[1],argv[3]];
 if(!/^[A-Za-z0-9_-]{1,100}$/.test(owner))throw Error("Invalid owner");
 if(env.BOUSTIO_READONLY_APPROVED!=="YES")
  throw Error("Explicit read-only production verification approval required");
 const auth=new GoogleAuth({scopes:["https://www.googleapis.com/auth/datastore"]});
 const credentials=await auth.getCredentials();
 // This check requires the effective ADC identity to be the dedicated service
 // account; the operator must also verify effective IAM grants independently.
 if(credentials.client_email!==EXPECTED_EMAIL)
  throw Error("ADC identity is not the dedicated read-only service account");
 const project=await auth.getProjectId();
 if(project!==EXPECTED_PROJECT)throw Error("Authenticated project mismatch");
 const archive=JSON.parse(fs.readFileSync(archivePath,"utf8"));
 if(archive.sourcePath!=="users/"+owner+"/liveData/bookings")
  throw Error("Archive owner path mismatch");
 // Uses ADC; no key file is created or committed by this runner.
 const app=admin.initializeApp({projectId:EXPECTED_PROJECT});
 try{
  const result=await verifyProductionReadOnly({db:app.firestore(),
   projectId:project,businessId:owner,authenticatedUid:owner,archive,
   operatorConfirmedReadOnly:true,operatorConfirmedOwner:true});
  process.stdout.write(JSON.stringify(result,null,2)+"\n");
  if(!result.ready)process.exitCode=1;
 }finally{await app.delete();}
}
if(require.main===module)main().catch(()=>fail("Authentication or verification failed; no data modified"));
module.exports={main,EXPECTED_EMAIL};
