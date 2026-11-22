"use strict";
// Offline planning only: no credentials, real project IDs, network calls or approval mutations.
const {auditPhase48}=require("../phase48/final-audit-48-7");
const {assessLaunchGaps}=require("../phase46/readiness-gaps-46-1");
const {assertNoCredentialEnvironment}=require("../phase47/staging-boundary-47-1");
const disabled=Object.freeze({accessGranted:false,stagingApproved:false,securityApproved:false,ownerApproved:false,deviceSignedOff:false,productionReady:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
const checklist=Object.freeze([
 {id:"isolation",requirement:"Dedicated non-production Firebase staging project, separate billing and access boundary; independent ownership confirmation",gate:"STAGING_APPROVAL"},
 {id:"least-privilege",requirement:"Document minimum IAM roles per principal, prohibit Owner/Editor and long-lived service-account keys, review audit logs and expiry",gate:"SECURITY_REVIEW"},
 {id:"secrets",requirement:"No secrets in source, logs or unapproved GitHub Actions; use approved short-lived identity only after authorization",gate:"SECURITY_REVIEW"},
 {id:"test-data",requirement:"Synthetic data only until separately approved; no production Firestore or Android appointment access",gate:"OWNER_APPROVAL"},
 {id:"kill-switch",requirement:"Bookings, payments, messaging and deployment stay disabled; independent rollback and incident controls",gate:"RELEASE_APPROVAL"}
].map(x=>Object.freeze({...x,status:"NOT_VERIFIED",approved:false})));
const closure=Object.freeze([
 "Trusted backend Admin revocation and owner authorization tested independently in approved staging",
 "Real App Check identity, attestation, expiry and distributed atomic replay tested independently",
 "Browser/Android end-to-end consistency, account switching and revision conflicts signed off",
 "Two original appointments backed up, restore/rollback verified non-destructively with explicit owner approval",
 "Physical Samsung accessibility, offline, restart and recovery signed off",
 "Privacy, monitoring, incident response and release approvals independently documented",
 "Independent security and concurrency review validates real staging authorization and isolation"
]);
function planStaging49({environment={},claims={}}={}){
 if(assertNoCredentialEnvironment(environment).status!=="NO_EXPLICIT_CREDENTIALS_IN_SUPPLIED_ENVIRONMENT")return Object.freeze({status:"DENIED",reason:"credential_boundary",...disabled});
 if(!claims||typeof claims!=="object"||Array.isArray(claims))return Object.freeze({status:"DENIED",reason:"invalid_claims",...disabled});
 const prior=auditPhase48({environment}),gaps=assessLaunchGaps();
 if(prior.status!=="PHASE48_ISOLATED_AUDIT_PREPARED_NOT_APPROVED"||gaps.openCount!==7||gaps.gaps.some(x=>x.status!=="OPEN"||x.approved!==false)||closure.length!==7)throw Error("launch_gate_changed");
 const evidence=Object.freeze(gaps.gaps.map((g,i)=>Object.freeze({id:g.id,priority:g.priority,owner:g.owner,approvalGate:g.gate,required:g.required,closureCriterion:closure[i],evidenceStatus:"MISSING",independentReview:"REQUIRED",status:"OPEN",approved:false})));
 return Object.freeze({status:"PHASE49_1_STAGING_PLAN_ONLY_NOT_APPROVED",checklist,evidence,openCount:7,checklistCount:5,independentApprovalsRequired:true,claimsAreNotApproval:Object.keys(claims).length>0,originalAppointments:"NOT_ACCESSED_OR_VERIFIED",...disabled});
}
module.exports=Object.freeze({planStaging49,checklist,closure});
