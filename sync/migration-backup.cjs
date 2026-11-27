"use strict";
// Dry-run integrity prototype. Digest must be retained separately in trusted storage.
const {createHash}=require("node:crypto");
const digest=raw=>createHash("sha256").update(raw,"utf8").digest("hex");
function validateBackup(raw,expectedDigest,businessId){
 if(typeof raw!=="string"||Buffer.byteLength(raw)>5000000||typeof expectedDigest!=="string"||digest(raw)!==expectedDigest)throw Error("Backup integrity failure");
 const data=JSON.parse(raw);
 if(!data||data.schemaVersion!==1||typeof businessId!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(businessId)||data.businessId!==businessId||!Array.isArray(data.appointments)||!Array.isArray(data.customers))throw Error("Invalid backup scope or schema");
 return {appointmentCount:data.appointments.length,customerCount:data.customers.length,digest:expectedDigest};
}
module.exports={validateBackup};