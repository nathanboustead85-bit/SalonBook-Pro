"use strict";
/**
 * Phase 17 named-database adapter (PREPARATION ONLY).
 * The caller must supply the Firebase Admin SDK factory and app. This module
 * never initialises Firebase, creates a database, grants IAM or deploys.
 * It must only be used by a separately authorised PUBLIC writer runtime.
 */
const PUBLIC_DATABASE_ID="boustio-public";
function publicDatabase({app,getFirestore}){
 if(!app||typeof getFirestore!=="function")throw Error("MISSING_TRUSTED_FIREBASE_ADAPTER");
 const database=getFirestore(app,PUBLIC_DATABASE_ID);
 if(!database||typeof database.collection!=="function"||typeof database.runTransaction!=="function")
  throw Error("INVALID_PUBLIC_DATABASE_ADAPTER");
 return database;
}
function assertIsolatedPublicWriterConfig(config){
 if(!config||config.databaseId!==PUBLIC_DATABASE_ID||
    config.runtimeRole!=="public-writer"||
    config.privateDatabaseAccess!==false||
    config.customerBookingsEnabled!==false)
  throw Error("PUBLIC_WRITER_CONFIG_NOT_APPROVED");
 return true;
}
module.exports=Object.freeze({PUBLIC_DATABASE_ID,publicDatabase,assertIsolatedPublicWriterConfig});
