"use strict";
/**
 * Phase 10.25 — production verification entrypoint, intentionally NOT executable
 * from GitHub Actions or a public endpoint. No credentials are stored here.
 * A trusted operator must supply a Firestore client with read-only IAM access.
 * Does not initialise, freeze, migrate, delete or publish anything.
 */
const {generateLiveReadinessReport}=require("./liveReadinessReport");
const EXPECTED_PROJECT="salonbook-pro-ad5ff";
const ID=/^[A-Za-z0-9_-]{1,100}$/;
function blocked(reason){return {ready:false,status:"BLOCKED",readOnly:true,
 productionChangePerformed:false,reason};}
async function verifyProductionReadOnly({
 db,projectId,businessId,authenticatedUid,archive,
 operatorConfirmedReadOnly=false,operatorConfirmedOwner=false
}={}){
 if(projectId!==EXPECTED_PROJECT)return blocked("Production project mismatch");
 if(operatorConfirmedReadOnly!==true||operatorConfirmedOwner!==true)
  return blocked("Separate read-only operator and owner confirmations required");
 if(!ID.test(businessId||"")||businessId!==authenticatedUid)
  return blocked("Business owner mismatch");
 if(!archive||archive.sourcePath!=="users/"+businessId+"/liveData/bookings")
  return blocked("Archive owner path mismatch");
 if(!db||typeof db.collection!=="function")
  return blocked("Trusted read-only Firestore client required");
 // No service-account creation, credentials, network connection, or writes here.
 try{
  return await generateLiveReadinessReport({db,businessId,authenticatedUid,archive});
 }catch(_){return blocked("Live verification failed safely");}
}
module.exports={verifyProductionReadOnly,EXPECTED_PROJECT};
