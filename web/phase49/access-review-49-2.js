"use strict";
// Offline security review only; no IAM API calls, credentials, environment provisioning or authorization.
const {planStaging49}=require("./staging-plan-49-1");
const {assertNoCredentialEnvironment}=require("../phase47/staging-boundary-47-1");
const disabled=Object.freeze({accessGranted:false,stagingApproved:false,securityApproved:false,iamApproved:false,credentialsApproved:false,productionReady:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
const matrix=Object.freeze([
 {principal:"human-staging-reviewer",scope:"staging-only",access:"metadata-read-only",purpose:"Inspect project IAM inventory",prohibited:"Owner, Editor, production project access"},
 {principal:"security-auditor",scope:"staging-only",access:"read-only audit evidence",purpose:"Review authentication, revocation and access logs",prohibited:"write permissions, secret extraction"},
 {principal:"ci-emulator-runner",scope:"local-demo-emulators",access:"no-cloud-roles",purpose:"Run isolated regression suites",prohibited:"cloud credentials, deployments"},
 {principal:"future-staging-service",scope:"staging-only-after-approval",access:"minimum task-specific role to be independently defined",purpose:"Future approved verification only",prohibited:"Owner, Editor, persistent service-account keys"}
].map(x=>Object.freeze({...x,status:"UNAPPROVED",approved:false})));
const controls=Object.freeze([
 {id:"project-boundary",evidence:"Independently verified dedicated staging project and no production resource links"},
 {id:"iam-review",evidence:"Named principal, exact resource, minimal role, justification, expiration, approver and revocation"},
 {id:"identity",evidence:"Short-lived workload identity only after approval; no downloaded keys or personal tokens"},
 {id:"logs",evidence:"Redacted audit logs, alerting, access review and incident response"},
 {id:"data",evidence:"Synthetic fixtures only, no production Firestore or original Android appointments"},
 {id:"release",evidence:"Independent security, owner, device and release approval; deploy disabled"}
].map(x=>Object.freeze({...x,status:"MISSING",approved:false})));
function reviewStagingAccess({environment={},claims={},inventory={}}={}){
 if(assertNoCredentialEnvironment(environment).status!=="NO_EXPLICIT_CREDENTIALS_IN_SUPPLIED_ENVIRONMENT")return Object.freeze({status:"DENIED",reason:"credential_boundary",...disabled});
 if(!claims||typeof claims!=="object"||Array.isArray(claims)||!inventory||typeof inventory!=="object"||Array.isArray(inventory))return Object.freeze({status:"DENIED",reason:"invalid_evidence",...disabled});
 // This planning interface never accepts real project IDs, credentials or IAM bindings.
 if(Object.keys(inventory).length)return Object.freeze({status:"DENIED",reason:"real_environment_inventory_not_authorized",...disabled});
 const plan=planStaging49({environment,claims});
 if(plan.status!=="PHASE49_1_STAGING_PLAN_ONLY_NOT_APPROVED"||plan.openCount!==7||plan.evidence.some(x=>x.status!=="OPEN"||x.approved))throw Error("launch_gate_changed");
 return Object.freeze({status:"PHASE49_2_ACCESS_REVIEW_ONLY_NOT_APPROVED",matrix,controls,evidence:plan.evidence,openCount:7,iamPrincipalCount:matrix.length,controlCount:controls.length,originalAppointments:"NOT_ACCESSED_OR_VERIFIED",...disabled});
}
module.exports=Object.freeze({reviewStagingAccess,matrix,controls});
