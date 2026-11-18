"use strict";
/**
 * Phase 17 complete PUBLIC-side handler assembly (offline preparation).
 * This module is not exported as a Cloud Function or HTTP route.
 * Deploy only after IAM, trusted private revision sequencing and rollback
 * are approved. Never expose the handler as a public unauthenticated route.
 */
const {createGoogleServiceTokenVerifier}=require("./phase17GoogleTokenVerifier");
const {acceptTrustedPublication}=require("./phase17ServiceIdentityBoundary");
const {publicDatabase,assertIsolatedPublicWriterConfig,PUBLIC_DATABASE_ID}=require("./phase17PublicDatabaseAdapter");
function createPublicWriterHandler({app,getFirestore,audience,googleClient,config}){
 assertIsolatedPublicWriterConfig(config);
 if(config.databaseId!==PUBLIC_DATABASE_ID)throw Error("WRONG_DATABASE");
 const verifyIdToken=createGoogleServiceTokenVerifier({expectedAudience:audience,client:googleClient});
 const db=publicDatabase({app,getFirestore});
 return async function handle({authorization,command}={}){
  // No direct client access, no dynamic audience, no default DB fallback.
  return acceptTrustedPublication({authorization,audience,verifyIdToken,publicDb:db,command});
 };
}
module.exports=Object.freeze({createPublicWriterHandler});
