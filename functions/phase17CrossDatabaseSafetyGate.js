"use strict";
/**
 * Offline architectural safety gate for cross-database publication.
 * A preflight private-DB lease check cannot atomically fence a public-DB
 * transaction. Do not use the legacy public writer's optional fence alone.
 * This gate only permits an explicitly co-located authoritative claim read.
 * No Firebase initialisation, IAM or deployment.
 */
const {applyPublicListingCommand}=require("./phase17PublicDatabaseWriter");
async function applyWithAuthoritativeClaim({publicDb,command,fence,claimPlacement,nowMs}={}){
 if(claimPlacement!=="destination-transaction")
  throw Error("CROSS_DATABASE_CLAIM_NOT_ATOMIC");
 if(!publicDb||typeof publicDb.collection!=="function"||
    typeof publicDb.runTransaction!=="function"||typeof nowMs!=="function")
  throw Error("AUTHORITATIVE_DESTINATION_ADAPTER_REQUIRED");
 if(!fence||fence.requiresDestinationFence!==true)
  throw Error("AUTHORITATIVE_FENCE_REQUIRED");
 return applyPublicListingCommand(publicDb,command,{
  fence:{key:fence.key,worker:fence.worker,generation:fence.generation},
  requireFence:true,
  requireAuthoritativeClaim:true,
  nowMs
 });
}
module.exports=Object.freeze({applyWithAuthoritativeClaim});
