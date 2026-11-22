"use strict";
// Planning-only dependency contract; intentionally does not instantiate Firebase or connect a dashboard.
const {createAndroidBusinessReader}=require("../phase36/android-business-adapter-36-1");
const {createOwnerAuthorizationGate}=require("../phase38/owner-authorization-38-3");
const {createDashboardRecovery}=require("../phase38/dashboard-recovery-38-4");
const {deny}=require("../phase38/schema-compatibility-38-2");
const REQUIRED=Object.freeze(["db","doc","runTransaction","credentials","now"]);
function assessDependencies(deps){
 const missing=REQUIRED.filter(k=>!deps||!(k in deps));
 if(missing.length)return Object.freeze({status:"NOT_READY",missing,productionLaunchApproved:false});
 if(!deps.db||typeof deps.doc!=="function"||typeof deps.runTransaction!=="function"||typeof deps.credentials!=="function"||typeof deps.now!=="function")return Object.freeze({status:"NOT_READY",missing:["invalid_dependencies"],productionLaunchApproved:false});
 return Object.freeze({status:"ISOLATED_DEPENDENCIES_PRESENT",missing:[],productionLaunchApproved:false});
}
function createIsolatedDashboardHarness(deps){
 const assessment=assessDependencies(deps);
 if(assessment.status!=="ISOLATED_DEPENDENCIES_PRESENT")throw TypeError("isolated_dependencies_required");
 const readAtomic=createAndroidBusinessReader({db:deps.db,doc:deps.doc,runTransaction:deps.runTransaction});
 const gate=createOwnerAuthorizationGate({readAtomic,now:deps.now});
 const recovery=createDashboardRecovery({gate,credentials:deps.credentials});
 return Object.freeze({snapshot:()=>recovery.snapshot(),refresh:()=>recovery.refresh(),retry:()=>recovery.retry(),networkUnavailable:()=>recovery.networkUnavailable(),networkRestored:()=>recovery.networkRestored(),background:()=>recovery.background(),foreground:()=>recovery.foreground(),signOut:()=>recovery.signOut(),accountChanged:()=>recovery.accountChanged(),stop:()=>recovery.stop(),launchApproved:false,canDeploy:false,canBook:false,canPay:false,canMessage:false});
}
module.exports=Object.freeze({assessDependencies,createIsolatedDashboardHarness,unavailable:()=>deny("integration_not_connected")});
