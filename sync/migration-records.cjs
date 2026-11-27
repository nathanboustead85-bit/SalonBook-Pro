"use strict";
const {validateBackup}=require("./migration-backup.cjs");
function validateRecords(raw,digest,businessId){
 const summary=validateBackup(raw,digest,businessId),data=JSON.parse(raw);
 for(const kind of ["appointments","customers"]){
 const seen=new Set();
 for(const record of data[kind]){
 if(!record||typeof record.id!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(record.id)||record.businessId!==businessId)throw Error("Invalid record identity");
 if(seen.has(record.id))throw Error("Duplicate record identity");
 seen.add(record.id);
 }
 }
 return summary;
}
module.exports={validateRecords};