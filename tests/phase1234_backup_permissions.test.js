"use strict";
const assert=require("node:assert/strict");
const {ROLES,ACTIONS,PERMISSIONS,authorize,deletionRequest}=require("../functions/backupAccessPolicy");
let checks=0;
for(const role of ROLES){
 for(const action of ACTIONS){
  const result=authorize(role,action);
  assert.equal(result.allowed,PERMISSIONS[role].includes(action),role+" "+action);
  assert.equal(result.destructiveOperationPerformed,false);
  assert.equal(result.productionPermissionGranted,false);
  checks++;
 }
}
console.log("PASS role/action matrix: "+checks+" authorization decisions");
for(const role of ["admin","owner","",null,undefined,"backup-writer "])
 assert.equal(authorize(role,"delete-version").allowed,false);
console.log("PASS unknown and malformed roles denied");
for(const role of ROLES){
 assert.equal(authorize(role,"delete-version").allowed,false);
 assert.equal(authorize(role,"create-version").allowed,role==="backup-writer");
 assert.equal(authorize(role,"read-version").allowed,role==="restore-reader");
}
console.log("PASS no role can directly delete backups");
const approval={approved:true,reviewer:"Independent Reviewer",ticket:"SEC-1234"};
for(const role of ["backup-writer","restore-reader","unknown"]){
 assert.equal(deletionRequest(role,"v001",approval).status,"DENIED");
}
console.log("PASS writer and reader cannot request deletion");
for(const bad of [undefined,null,{}, {approved:false,reviewer:"Independent Reviewer",ticket:"SEC-1234"},
 {approved:true,reviewer:"",ticket:"SEC-1234"},
 {approved:true,reviewer:"Independent Reviewer",ticket:""}]){
 assert.equal(deletionRequest("deletion-admin","v001",bad).status,"DENIED");
}
console.log("PASS deletion requests require independent approval evidence");
const request=deletionRequest("deletion-admin","v001",approval);
assert.equal(request.status,"REVIEW_ONLY");
assert.equal(request.deleted,false);
assert.equal(request.auditRequired,true);
console.log("PASS approved deletion request remains non-destructive");
assert.equal(deletionRequest("deletion-admin","../secret",approval).status,"DENIED");
console.log("PASS invalid backup version IDs rejected");
