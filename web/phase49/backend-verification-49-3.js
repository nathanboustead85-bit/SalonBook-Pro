"use strict";
// Independent backend verification PROCEDURES only. No Admin SDK, credentials or real staging calls.
const {reviewStagingAccess}=require("./access-review-49-2");
const {assertNoCredentialEnvironment}=require("../phase47/staging-boundary-47-1");
const disabled=Object.freeze({accessGranted:false,stagingApproved:false,securityApproved:false,backendApproved:false,revocationVerified:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
const procedures=Object.freeze([
 ["admin-revocation","Approved staging-only Admin verifyIdToken(token,true); compare revoked, valid and tampered ID tokens; verify checkRevoked is actually true"],
 ["owner-isolation","Different staging owner IDs, unverified/anonymous accounts and cross-owner resource reads must be denied by trusted backend and Firestore"],
 ["session-expiry","Expired ID tokens, clock skew, refreshed tokens and session invalidation must fail closed; independently record timestamps"],
 ["credential-boundary","Document workload identity scope, minimal roles, keyless access, audit logging, rotation and revocation without exporting secrets"],
 ["concurrency","Concurrent revocation and account switching cannot leave stale authorizations; require real staging test evidence"],
 ["independent-review","Record reviewer, environment attestation, redacted trace IDs, expected/actual results, date, findings, remediation and signoff"]
].map(([id,procedure])=>Object.freeze({id,procedure,evidence:"MISSING",independentApproval:"REQUIRED",approved:false})));
function prepareBackendVerification({environment={},claims={},inventory={}}={}){
 if(assertNoCredentialEnvironment(environment).status!=="NO_EXPLICIT_CREDENTIALS_IN_SUPPLIED_ENVIRONMENT")return Object.freeze({status:"DENIED",reason:"credential_boundary",...disabled});
 if(!claims||typeof claims!=="object"||Array.isArray(claims)||!inventory||typeof inventory!=="object"||Array.isArray(inventory))return Object.freeze({status:"DENIED",reason:"invalid_input",...disabled});
 const prior=reviewStagingAccess({environment,claims,inventory});
 if(prior.status!=="PHASE49_2_ACCESS_REVIEW_ONLY_NOT_APPROVED")return Object.freeze({status:"DENIED",reason:"access_boundary",...disabled});
 if(prior.openCount!==7||prior.evidence.some(x=>x.status!=="OPEN"||x.approved)||procedures.length!==6)throw Error("launch_gate_changed");
 return Object.freeze({status:"PHASE49_3_BACKEND_PROCEDURES_ONLY_NOT_APPROVED",procedures,procedureCount:6,blockers:prior.evidence,openCount:7,originalAppointments:"NOT_ACCESSED_OR_VERIFIED",realFirebaseAdminTests:"NOT_PERFORMED",...disabled});
}
module.exports=Object.freeze({prepareBackendVerification,procedures});
